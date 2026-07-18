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
import { readFileSync, existsSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../build-graph.js';
import { ConfigLoader } from '../config.js';
import { QueryEngine } from '../query-engine.js';

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

const graph = buildGraph(root, { tracks: config.filter.tracks, domains: config.filter.domains });
const engine = new QueryEngine(graph, 'unused-retrieval-is-key-free');
const graphJSON = JSON.stringify(graph.toJSON());

const SYSTEM_PROMPT = `You are an expert in a software project's history and architecture.
You read a TWO-AXIS knowledge graph of a language-learning platform:
- a TIME axis of stories and epics (completed units of work), and
- a DOMAIN axis of workspace units and the concerns within them.
Provenance edges ('sources') connect a domain's current state back to the stories/epics that produced it.
Answer ONLY from the graph context supplied below. Be specific: cite story/epic IDs, workspace
domains, and PR numbers. Group your reasoning by domain, not by epic — an epic is a unit of work
in time, not a unit of knowledge. If the context doesn't contain the answer, say so plainly.`;

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
  console.log(`   Ollama: ${OLLAMA}`);
});
