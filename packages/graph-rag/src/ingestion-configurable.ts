import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from './graph.js';
import type { GraphRagConfig } from './config.js';
import { shouldIngestEpisode } from './config.js';

export class ConfigurableDataIngestion {
  projectRoot: string;
  config: GraphRagConfig;

  constructor(projectRoot: string, config: GraphRagConfig) {
    this.projectRoot = projectRoot;
    this.config = config;
  }

  async ingest(): Promise<ProjectGraph> {
    const graph = new ProjectGraph();

    console.log('📊 Ingesting project structure...');
    console.log(`📋 Focus: ${this.config.focus.title}`);
    console.log(`   ${this.config.focus.description}\n`);

    // Step 1: Parse epic plans (if enabled)
    if (this.config.sources.epics.enabled) {
      console.log('Step 1: Parsing epic plans...');
      this.ingestEpics(graph);
    } else {
      console.log('Step 1: Skipped (epics disabled in config)');
    }

    // Step 2: Parse changelogs (if enabled)
    if (this.config.sources.changelogs.enabled) {
      console.log('Step 2: Parsing changelogs...');
      this.ingestChangelogs(graph);
    } else {
      console.log('Step 2: Skipped (changelogs disabled in config)');
    }

    // Step 3: Parse git history (if enabled)
    if (this.config.sources.git.enabled) {
      console.log('Step 3: Parsing git history...');
      // TODO: implement git ingestion
      console.log('   (git ingestion not yet implemented)');
    }

    return graph;
  }

  private ingestEpics(graph: ProjectGraph): void {
    const epicsDir = join(this.projectRoot, this.config.sources.epics.path);
    let epicFiles = readdirSync(epicsDir).filter((f) => f.endsWith('.md'));

    // Apply episode filter
    epicFiles = epicFiles.filter((f) => {
      const match = f.match(/EP(\d+)/);
      if (!match) return false;
      const episodeNum = parseInt(match[1]);
      return shouldIngestEpisode(episodeNum, this.config.sources.epics.filter);
    });

    if (this.config.logging.verbose) {
      console.log(`   Found ${epicFiles.length} epic files matching filter`);
    }

    for (const epicFile of epicFiles) {
      const content = readFileSync(join(epicsDir, epicFile), 'utf-8');
      const episodeMatch = epicFile.match(/EP(\d+)/);
      if (!episodeMatch) continue;

      const episodeNum = `EP${episodeMatch[1]}`;
      const titleMatch = epicFile.match(/EP\d+-(.+?)\.md/);
      const title = titleMatch ? titleMatch[1].replace(/-/g, ' ') : epicFile;

      // Extract problem statement (if enabled)
      let problem = '';
      if (this.config.extraction.episodes.extract_problem_statement) {
        const problemMatch = content.match(/## Problem Statement\n\n([\s\S]*?)\n\n/);
        problem = problemMatch ? problemMatch[1].trim() : '';
      }

      // Extract dependencies (if enabled)
      let dependencies: string[] = [];
      if (this.config.extraction.episodes.extract_dependencies) {
        const depMatch = content.match(/\*\*Depends on\*\*:\s*(.*?)\n/);
        if (depMatch) {
          dependencies = depMatch[1]
            .split(/[,\/]/)
            .map((d) => d.trim())
            .filter((d) => d && d !== 'N/A' && d !== 'N' && d !== 'A');
        }
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

      // Extract stories (if enabled)
      if (this.config.extraction.episodes.extract_stories) {
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

      if (this.config.logging.log_extractions) {
        console.log(`     ✓ ${episodeNum} (${dependencies.length} deps)`);
      }
    }

    console.log(`✓ Parsed ${epicFiles.length} epic plans`);
  }

  private ingestChangelogs(graph: ProjectGraph): void {
    const changelogsDir = join(this.projectRoot, this.config.sources.changelogs.path);
    let episodeDirs = readdirSync(changelogsDir).filter((f) => f.startsWith('EP'));

    // Apply episode filter
    episodeDirs = episodeDirs.filter((dir) => {
      const match = dir.match(/EP(\d+)/);
      if (!match) return false;
      const episodeNum = parseInt(match[1]);
      return shouldIngestEpisode(episodeNum, this.config.sources.changelogs.filter);
    });

    if (this.config.logging.verbose) {
      console.log(`   Found ${episodeDirs.length} changelog directories matching filter`);
    }

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

        // Extract design specs (if enabled)
        if (this.config.extraction.changelogs.extract_design_specs) {
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
        }

        // Extract files modified (if enabled)
        if (this.config.extraction.changelogs.extract_files_modified) {
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
        }

        // Extract corrections (if enabled)
        if (this.config.extraction.changelogs.extract_corrections) {
          const correctionsSection = content.match(/## .*Spec Gaps Corrected([\s\S]*?)(?=##|$)/);
          if (correctionsSection) {
            const dsMatch = file.match(/(\d{8}T\d{6}Z)?-?(DS\d+)?-/);
            const designSpecId = dsMatch && dsMatch[2] ? dsMatch[2] : null;
            if (designSpecId) {
              graph.addEdge({
                from: episodeNum,
                to: designSpecId,
                type: 'corrected-from',
                label: 'corrected spec',
              });
            }
          }
        }

        changelogCount++;
      }

      if (this.config.logging.log_extractions) {
        console.log(`     ✓ ${episodeNum}`);
      }
    }

    console.log(`✓ Parsed ${changelogCount} changelog files`);
  }
}
