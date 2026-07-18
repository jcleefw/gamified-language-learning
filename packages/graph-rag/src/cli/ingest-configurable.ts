#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ConfigurableDataIngestion } from '../ingestion-configurable.js';
import { ConfigLoader } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const projectRoot = join(__dirname, '../../../..');
  const configPath = join(projectRoot, 'packages/graph-rag/.graph-rag-config.json');

  console.log('🚀 Building graph with configuration-driven ingestion\n');

  // Load configuration
  let config;
  if (existsSync(configPath)) {
    console.log(`📋 Loading config from: .graph-rag-config.json\n`);
    const loader = new ConfigLoader(configPath);
    config = loader.load();
  } else {
    console.log('⚠️  No config file found, using defaults\n');
    config = ConfigLoader.getDefault();
  }

  // Show what we're about to do
  console.log('Configuration Summary:');
  console.log(`  Sources enabled: ${[
    config.sources.epics.enabled && 'epics',
    config.sources.changelogs.enabled && 'changelogs',
    config.sources.git.enabled && 'git',
  ]
    .filter(Boolean)
    .join(', ')}`);

  if (config.sources.epics.filter.episodes !== null) {
    console.log(`  Episode filter: ${JSON.stringify(config.sources.epics.filter.episodes)}`);
  }

  console.log();

  // Run ingestion
  const ingestion = new ConfigurableDataIngestion(projectRoot, config);
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

  // Backup existing graph if configured
  const outputPath = join(projectRoot, 'packages/graph-rag', config.output.graph_file);
  if (config.output.backup_previous && existsSync(outputPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = outputPath.replace('.json', `.backup-${timestamp}.json`);
    const existing = readFileSync(outputPath, 'utf-8');
    writeFileSync(backupPath, existing);
    console.log(`\n💾 Previous graph backed up to: ${backupPath}`);
  }

  // Save new graph
  console.log(`💾 Saving graph to: ${config.output.graph_file}`);
  const jsonString = config.output.pretty_print
    ? JSON.stringify(nodeData, null, 2)
    : JSON.stringify(nodeData);
  writeFileSync(outputPath, jsonString);

  console.log(`\n✅ Knowledge graph built and saved!`);
  console.log(`\n📝 Focus: ${config.focus.title}`);
  console.log(`   ${config.focus.description}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
