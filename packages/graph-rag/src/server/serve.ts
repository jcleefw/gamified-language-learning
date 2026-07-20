#!/usr/bin/env node

// ---------------------------------------------------------------------------
// Local explorer server for the two-axis knowledge graph.
//
// Why local (and not a hosted artifact): the chat routes generation to a local
// Ollama daemon at http://localhost:11434, which a sandboxed browser artifact
// cannot reach. Retrieval stays KEY-FREE and server-side (getContext +
// contextToString from the package); only the final generation hop calls Ollama.
//
//   pnpm --filter @gll/graph-rag graph:ui
//   pnpm --filter @gll/graph-rag graph:ui -- --root=. --port=5173
//
// Endpoints:
//   GET  /              -> single-page explorer (graph + chat)
//   GET  /api/graph     -> the built graph as JSON
//   GET  /api/models    -> local Ollama models (proxied /api/tags)
//   POST /api/query     -> SSE stream: {context nodeIds} then generated tokens
// ---------------------------------------------------------------------------

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../build-graph.js';
import { ConfigLoader } from '../config.js';
import { QueryEngine } from '../query-engine.js';
import { findAdrFiles, adrSlug, parseAdr } from '../readers/adr.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../../..');
const packageDir = join(repoRoot, 'packages/graph-rag');

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const PORT = Number(arg('port') ?? process.env.PORT ?? 5179);
const OLLAMA = (arg('ollama') ?? process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');

// --- Build the graph once at boot ------------------------------------------
const configPath = join(packageDir, '.graph-rag-config.json');
const config = existsSync(configPath)
  ? new ConfigLoader(configPath).load()
  : ConfigLoader.getDefault();

const configuredRoot = arg('root') ?? config.root ?? '.';
const root = isAbsolute(configuredRoot) ? configuredRoot : join(repoRoot, configuredRoot);

// --no-adrs skips ADR ingestion; --adr=file1.md,file2.md restricts to those
// files (by filename or slug). Both override the config; CLI wins.
const noAdrs = process.argv.includes('--no-adrs');
const adrArg = arg('adr');
const adrFiles = adrArg ? adrArg.split(',').map((s) => s.trim()).filter(Boolean) : config.adrs.files;
const includeAdrs = noAdrs ? false : config.adrs.include;
const buildOptions = { tracks: config.filter.tracks, domains: config.filter.domains, includeAdrs, adrFiles };

// Mutable: a live ADR re-link edits an ADR file, rebuilds, and swaps these in.
let graph = buildGraph(root, buildOptions);
let engine = new QueryEngine(graph, 'unused-retrieval-is-key-free');
let graphJSON = JSON.stringify(graph.toJSON());

function rebuild(): void {
  graph = buildGraph(root, buildOptions);
  engine = new QueryEngine(graph, 'unused-retrieval-is-key-free');
  graphJSON = JSON.stringify(graph.toJSON());
}

const SYSTEM_PROMPT = `You are an expert in a software project's architecture, reading a
knowledge graph organized by KNOWLEDGE, not by work:
- domain nodes are workspace units (apps/*, packages/*);
- ryoiki nodes are named areas of knowledge within a domain, each carrying the durable
  description of how that area works, plus provenance (the stories/epics/PRs that produced it);
- adr nodes are architecture DECISIONS (the *why*). A 'decides' edge points from an ADR to the
  ryoiki/domain it governs; a 'supersedes' edge points from a newer ADR to the one it replaces.
  An ADR with no 'decides' edge is a decision that is not yet realized in a ryoiki.
Answer ONLY from the graph context below. Be specific: name domains and ryoiki, cite the
producing story/epic IDs and PR numbers, and when asked *why*, cite the governing ADR and its
status. Organize the answer around ryoiki, not epics. If the context lacks the answer, say so.`;

// --- Helpers ----------------------------------------------------------------
function send(res: ServerResponse, code: number, type: string, body: string | Buffer): void {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`);
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: { name: string }[] };
    return (json.models ?? []).map((m) => m.name).sort();
  } catch {
    return [];
  }
}

// --- SSE query handler ------------------------------------------------------
async function handleQuery(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  let question = '';
  let model = 'qwen3-coder:30b';
  try {
    const parsed = JSON.parse(body || '{}');
    question = String(parsed.question ?? '').trim();
    if (parsed.model) model = String(parsed.model);
  } catch {
    /* fall through to empty-question guard */
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  const emit = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  if (!question) {
    emit({ type: 'error', message: 'Empty question.' });
    res.end();
    return;
  }

  // Key-free retrieval: which nodes/edges ground this answer.
  const context = engine.getContext(question);
  const contextStr = engine.contextToString(context);
  emit({
    type: 'context',
    nodeIds: context.relevantNodes.map((n) => n.id),
    subgraphNodeIds: context.subgraph.nodes.map((n) => n.id),
    edges: context.subgraph.edges,
    model,
  });

  // Generation hop -> Ollama (OpenAI-compatible, streamed).
  try {
    const ollamaRes = await fetch(`${OLLAMA}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Question: ${question}\n\n---\n\n${contextStr}` },
        ],
      }),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      emit({ type: 'error', message: `Ollama ${ollamaRes.status}: ${await ollamaRes.text()}` });
      res.end();
      return;
    }

    // Parse the OpenAI-style SSE chunk stream and forward token deltas.
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) emit({ type: 'token', text: delta });
        } catch {
          /* ignore keep-alive / non-JSON lines */
        }
      }
    }
    emit({ type: 'done' });
  } catch (err) {
    emit({
      type: 'error',
      message: `Could not reach Ollama at ${OLLAMA}. Is it running? (${(err as Error).message})`,
    });
  }
  res.end();
}

// --- ADR link write-back ----------------------------------------------------
// The ADR file is the SOURCE OF TRUTH for its links (`.graph-data.json` is a
// rebuilt cache). Adding/removing a link edits the ADR's `**Decides:**` field on
// disk, then rebuilds — so a reset + rebuild reconstructs the link from the ADR.

/** Rewrite (or insert/remove) the `**Decides:**` field to carry exactly `targets`. */
function setDecidesField(content: string, targets: string[]): string {
  const line = targets.length ? `**Decides:** ${targets.join(', ')}` : '';
  const existing = /^\*\*Decides:\*\*.*$/m;
  if (existing.test(content)) {
    return line ? content.replace(existing, line) : content.replace(/^\*\*Decides:\*\*.*\n?/m, '');
  }
  if (!line) return content;
  const sepIdx = content.search(/\n---\n/);
  return sepIdx >= 0
    ? `${content.slice(0, sepIdx)}\n${line}\n${content.slice(sepIdx)}`
    : `${content}\n\n${line}\n`;
}

async function handleLink(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let adrSlugArg = '';
  let target = '';
  let op = 'add';
  try {
    const parsed = JSON.parse((await readBody(req)) || '{}');
    adrSlugArg = String(parsed.adrSlug ?? '').trim();
    target = String(parsed.target ?? '').trim();
    if (parsed.op) op = String(parsed.op);
  } catch {
    /* fall through to guard */
  }
  if (!adrSlugArg || !target || (op !== 'add' && op !== 'remove')) {
    return send(res, 400, 'application/json', JSON.stringify({ error: 'bad request' }));
  }

  // Only files the ADR reader recognises are editable — keeps writes inside the
  // architecture dir and to a real ADR.
  const file = findAdrFiles(root).find((f) => adrSlug(f.slice(f.lastIndexOf('/') + 1)) === adrSlugArg);
  if (!file) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown adr' }));

  const content = readFileSync(file, 'utf-8');
  const doc = parseAdr(content, file);
  let targets = doc ? [...doc.decides] : [];
  if (op === 'add' && !targets.includes(target)) targets.push(target);
  if (op === 'remove') targets = targets.filter((t) => t !== target);

  writeFileSync(file, setDecidesField(content, targets));
  rebuild(); // re-read the ADR (now the source of truth) into a fresh graph
  return send(res, 200, 'application/json', graphJSON);
}

// --- Router -----------------------------------------------------------------
const uiPath = join(__dirname, 'ui.html');

const server = createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  try {
    if (req.method === 'GET' && url === '/') {
      return send(res, 200, 'text/html; charset=utf-8', readFileSync(uiPath));
    }
    if (req.method === 'GET' && url === '/api/graph') {
      return send(res, 200, 'application/json', graphJSON);
    }
    if (req.method === 'GET' && url === '/api/models') {
      const models = await listModels();
      return send(res, 200, 'application/json', JSON.stringify({ models, ollama: OLLAMA }));
    }
    if (req.method === 'POST' && url === '/api/query') {
      return handleQuery(req, res);
    }
    if (req.method === 'POST' && url === '/api/link') {
      return handleLink(req, res);
    }
    send(res, 404, 'text/plain', 'Not found');
  } catch (err) {
    send(res, 500, 'text/plain', `Server error: ${(err as Error).message}`);
  }
});

server.listen(PORT, () => {
  const summary = graph.toJSON().summary;
  console.log('🔭 Graph explorer running');
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`   Root:   ${root}`);
  console.log(`   Graph:  ${summary.totalNodes} nodes / ${summary.totalEdges} edges`);
  if (!includeAdrs) console.log(`   ADRs:   excluded`);
  else if (adrFiles) console.log(`   ADRs:   ${adrFiles.join(', ')}`);
  console.log(`   Ollama: ${OLLAMA}`);
});
