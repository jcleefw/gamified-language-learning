#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ProjectGraph, QueryEngine } from '../index.js';
import type { GraphData } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const graphPath = join(__dirname, '../../.graph-data.json');

  const graphData = JSON.parse(readFileSync(graphPath, 'utf-8')) as GraphData;

  // Reconstruct graph from JSON
  const graph = new ProjectGraph();
  graphData.nodes.forEach((node) => graph.addNode(node));
  graphData.edges.forEach((edge) => graph.addEdge(edge));

  const engine = new QueryEngine(graph);

  // Demo queries — concern-centric phrasing (knowledge + provenance).
  const queries = [
    'How does routing work in srs-demo and which work produced it?',
    'What does the graph say about batch composition?',
    'How is the srs-demo app shell structured?',
  ];

  console.log('🤖 Graph RAG Query Engine\n');
  console.log('='.repeat(70));

  for (const query of queries.slice(0, 1)) {
    // Show just first one in CLI
    console.log(`\nQuery: "${query}"\n`);

    const context = engine.getContext(query);
    const contextStr = engine.contextToString(context);

    console.log('EXTRACTED GRAPH CONTEXT:\n');
    console.log(contextStr);

    console.log('\n' + '─'.repeat(70));
    console.log('📝 To query with LLM reasoning:\n');
    console.log('```typescript');
    console.log(`const result = await engine.query('${queries[0]}');`);
    console.log('console.log(result.answer);');
    console.log('```');
  }

  console.log('\n✅ Graph is ready for LLM queries!');
  console.log('\nGraph Stats:');
  console.log(`- Total nodes: ${graph.nodes.size}`);
  console.log(`- Total edges: ${graph.edges.length}`);
  console.log('- Node types:', graphData.summary.nodesByType);
}

main().catch(console.error);
