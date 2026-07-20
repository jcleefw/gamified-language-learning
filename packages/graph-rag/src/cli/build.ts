#!/usr/bin/env node

import { writeFileSync, existsSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../build-graph.js';
import { ConfigLoader } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo root is four levels up from packages/graph-rag/src/cli/.
const repoRoot = join(__dirname, '../../../..');
const packageDir = join(repoRoot, 'packages/graph-rag');

function main(): void {
  const configPath = join(packageDir, '.graph-rag-config.json');
  const config = existsSync(configPath)
    ? new ConfigLoader(configPath).load()
    : ConfigLoader.getDefault();

  // --root override lets you point at the fixture without editing config.
  const rootArg = process.argv.find((a) => a.startsWith('--root='))?.slice('--root='.length);
  const configuredRoot = rootArg ?? config.root ?? '.';
  const root = isAbsolute(configuredRoot) ? configuredRoot : join(repoRoot, configuredRoot);

  console.log('🚀 Building ryoiki-centric knowledge graph');
  console.log(`   Focus: ${config.focus.title}`);
  console.log(`   Root:  ${root}`);
  if (config.filter.tracks) console.log(`   Tracks: ${config.filter.tracks.join(', ')}`);
  if (config.filter.domains) console.log(`   Domains: ${config.filter.domains.join(', ')}`);

  const graph = buildGraph(root, { tracks: config.filter.tracks, domains: config.filter.domains });
  const data = graph.toJSON();

  console.log(`\n📈 ${data.summary.totalNodes} nodes, ${data.summary.totalEdges} edges`);
  console.log(
    `   Node types: ${Object.entries(data.summary.nodesByType)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ')}`,
  );

  const outputPath = join(packageDir, config.output.graph_file);
  const json = config.output.pretty_print
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  writeFileSync(outputPath, json);
  console.log(`\n💾 Saved to ${config.output.graph_file}`);
}

main();
