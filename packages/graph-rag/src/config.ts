import { readFileSync } from 'fs';
import { join } from 'path';

export interface GraphRagConfig {
  focus: {
    title: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  sources: {
    epics: {
      enabled: boolean;
      path: string;
      filter: {
        episodes: null | number[] | Array<[number, number]>;
      };
    };
    changelogs: {
      enabled: boolean;
      path: string;
      filter: {
        episodes: null | number[] | Array<[number, number]>;
      };
    };
    git: {
      enabled: boolean;
    };
    custom: {
      enabled: boolean;
    };
  };
  extraction: {
    episodes: {
      extract_problem_statement: boolean;
      extract_dependencies: boolean;
      extract_stories: boolean;
      extract_acceptance_criteria: boolean;
    };
    changelogs: {
      extract_design_specs: boolean;
      extract_files_modified: boolean;
      extract_corrections: boolean;
      extract_lessons_learned: boolean;
    };
    custom_fields: Array<{
      name: string;
      section_header: string;
      node_type: string;
      edge_type: string;
    }>;
  };
  output: {
    graph_file: string;
    pretty_print: boolean;
    save_validation_report: boolean;
    backup_previous: boolean;
  };
  validation: {
    check_orphaned_nodes: boolean;
    check_circular_deps: boolean;
    check_epic_changelog_sync: boolean;
    fail_on_validation_error: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    verbose: boolean;
    log_extractions: boolean;
    profile: boolean;
  };
}

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(): GraphRagConfig {
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as GraphRagConfig;
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  static getDefault(): GraphRagConfig {
    return {
      focus: {
        title: 'Graph RAG POC',
        description: 'Learning knowledge graph querying',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      sources: {
        epics: {
          enabled: true,
          path: '.agents/plans/epics',
          filter: {
            episodes: null, // All episodes
          },
        },
        changelogs: {
          enabled: true,
          path: '.agents/changelogs',
          filter: {
            episodes: null, // All episodes
          },
        },
        git: {
          enabled: false,
        },
        custom: {
          enabled: false,
        },
      },
      extraction: {
        episodes: {
          extract_problem_statement: true,
          extract_dependencies: true,
          extract_stories: true,
          extract_acceptance_criteria: false,
        },
        changelogs: {
          extract_design_specs: true,
          extract_files_modified: true,
          extract_corrections: true,
          extract_lessons_learned: false,
        },
        custom_fields: [],
      },
      output: {
        graph_file: '.graph-data.json',
        pretty_print: true,
        save_validation_report: true,
        backup_previous: true,
      },
      validation: {
        check_orphaned_nodes: true,
        check_circular_deps: true,
        check_epic_changelog_sync: true,
        fail_on_validation_error: false,
      },
      logging: {
        level: 'info',
        verbose: true,
        log_extractions: false,
        profile: false,
      },
    };
  }
}

export function shouldIngestEpisode(episodeNum: number, filter: GraphRagConfig['sources']['epics']['filter']): boolean {
  if (filter.episodes === null) return true; // All episodes

  // Handle array of individual episodes or ranges
  if (Array.isArray(filter.episodes)) {
    for (const item of filter.episodes) {
      if (typeof item === 'number' && item === episodeNum) {
        return true;
      }
      if (Array.isArray(item) && item.length === 2) {
        const [start, end] = item as [number, number];
        if (episodeNum >= start && episodeNum <= end) {
          return true;
        }
      }
    }
    return false;
  }

  return true;
}
