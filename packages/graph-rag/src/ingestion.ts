import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from './graph.js';

export class DataIngestion {
  projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async ingest(): Promise<ProjectGraph> {
    const graph = new ProjectGraph();

    console.log('📊 Ingesting project structure...\n');

    // Step 1: Parse epic plans
    console.log('Step 1: Parsing epic plans...');
    this.ingestEpics(graph);

    // Step 2: Parse changelogs
    console.log('Step 2: Parsing changelogs...');
    this.ingestChangelogs(graph);

    return graph;
  }

  private ingestEpics(graph: ProjectGraph): void {
    const epicsDir = join(this.projectRoot, '.agents', 'plans', 'epics');
    const epicFiles = readdirSync(epicsDir).filter((f) => f.endsWith('.md'));

    for (const epicFile of epicFiles) {
      const content = readFileSync(join(epicsDir, epicFile), 'utf-8');
      const episodeMatch = epicFile.match(/EP(\d+)/);
      if (!episodeMatch) continue;

      const episodeNum = `EP${episodeMatch[1]}`;
      const titleMatch = epicFile.match(/EP\d+-(.+?)\.md/);
      const title = titleMatch ? titleMatch[1].replace(/-/g, ' ') : epicFile;

      // Extract problem statement
      const problemMatch = content.match(/## Problem Statement\n\n([\s\S]*?)\n\n/);
      const problem = problemMatch ? problemMatch[1].trim() : '';

      // Extract dependencies
      const depMatch = content.match(/\*\*Depends on\*\*:\s*(.*?)\n/);
      let dependencies: string[] = [];
      if (depMatch) {
        dependencies = depMatch[1]
          .split(/[,\/]/)
          .map((d) => d.trim())
          .filter((d) => d && d !== 'N/A' && d !== 'N' && d !== 'A');
      }

      // Add episode node
      graph.addNode({
        id: episodeNum,
        type: 'episode',
        label: `${episodeNum}: ${title}`,
        metadata: {
          file: epicFile,
          problem,
          dependencies,
        },
      });

      // Parse stories
      const storyRegex = /### (EP\d+-ST\d+):\s*(.+?)\n/g;
      let storyMatch;
      // eslint-disable-next-line no-cond-assign
      while ((storyMatch = storyRegex.exec(content))) {
        const storyId = storyMatch[1];
        const storyTitle = storyMatch[2];

        graph.addNode({
          id: storyId,
          type: 'story',
          label: `${storyId}: ${storyTitle}`,
          metadata: { episode: episodeNum },
        });

        graph.addEdge({
          from: episodeNum,
          to: storyId,
          type: 'contains',
          label: 'contains story',
        });
      }

      // Add dependency edges
      dependencies.forEach((dep) => {
        graph.addEdge({
          from: episodeNum,
          to: dep,
          type: 'depends-on',
          label: 'depends on',
        });
      });
    }

    console.log(`✓ Parsed ${epicFiles.length} epic plans`);
  }

  private ingestChangelogs(graph: ProjectGraph): void {
    const changelogsDir = join(this.projectRoot, '.agents', 'changelogs');
    const episodeDirs = readdirSync(changelogsDir).filter((f) => f.startsWith('EP'));

    let changelogCount = 0;
    for (const episodeDir of episodeDirs) {
      const episodeMatch = episodeDir.match(/EP(\d+)/);
      if (!episodeMatch) continue;

      const episodeNum = `EP${episodeMatch[1]}`;
      const changelogPath = join(changelogsDir, episodeDir);
      const changelogFiles = readdirSync(changelogPath);

      for (const file of changelogFiles) {
        if (!file.endsWith('.md')) continue;

        const content = readFileSync(join(changelogPath, file), 'utf-8');

        // Extract design spec references
        const dsMatch = file.match(/(\d{8}T\d{6}Z)?-?(DS\d+)?-/);
        const designSpecId = dsMatch && dsMatch[2] ? dsMatch[2] : null;

        if (designSpecId) {
          if (!graph.getNode(designSpecId)) {
            graph.addNode({
              id: designSpecId,
              type: 'design-spec',
              label: designSpecId,
              metadata: { episode: episodeNum, file },
            });
          }

          graph.addEdge({
            from: designSpecId,
            to: episodeNum,
            type: 'defines',
            label: 'defines',
          });
        }

        // Extract files modified
        const filesSection = content.match(/## Files Modified\n\n([\s\S]*?)(?=##|$)/);
        if (filesSection) {
          const fileMatches = filesSection[1].match(/### `([^`]+)`/g);
          if (fileMatches) {
            fileMatches.forEach((match) => {
              const filePath = match.replace(/### `|`/g, '');
              const fileId = `file:${filePath}`;

              if (!graph.getNode(fileId)) {
                graph.addNode({
                  id: fileId,
                  type: 'component',
                  label: filePath,
                  metadata: { type: 'file' },
                });
              }

              graph.addEdge({
                from: episodeNum,
                to: fileId,
                type: 'modified',
                label: 'modified',
              });
            });
          }
        }

        // Extract corrections
        const correctionsSection = content.match(/## .*Spec Gaps Corrected([\s\S]*?)(?=##|$)/);
        if (correctionsSection && designSpecId) {
          graph.addEdge({
            from: episodeNum,
            to: designSpecId,
            type: 'corrected-from',
            label: 'corrected spec',
          });
        }

        changelogCount++;
      }
    }

    console.log(`✓ Parsed ${changelogCount} changelog files`);
  }
}
