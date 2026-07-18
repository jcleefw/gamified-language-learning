#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DataIngestion } from '../ingestion.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const projectRoot = join(__dirname, '../../../..');

  console.log('🚀 Building project knowledge graph...\n');

  const ingestion = new DataIngestion(projectRoot);
  const graph = await ingestion.ingest();

  console.log(`\n📈 Graph Summary:`);
  console.log(`Total nodes: ${graph.nodes.size}`);
  console.log(`Total edges: ${graph.edges.length}`);

  const nodeData = graph.toJSON();
  console.log(
    `Node types: ${Object.entries(nodeData.summary.nodesByType)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ')}`,
  );

  console.log('\n💾 Exporting graph...');
  const outputPath = join(projectRoot, 'packages/graph-rag/.graph-data.json');
  writeFileSync(outputPath, JSON.stringify(nodeData, null, 2));
  console.log(`✓ Graph saved to .graph-data.json`);

  console.log('\n✅ Knowledge graph ready for querying!');
}

main().catch(console.error);
