import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Config for the two-axis reader. Filters are by `track` / `domain` — the axes
// the archive actually carries — NOT by episode range (the old epic-grouped
// model is gone).
// ---------------------------------------------------------------------------

export interface GraphRagConfig {
  focus: {
    title: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  /** Base directory the readers mount at. Absolute, or relative to the repo root. */
  root: string;
  filter: {
    /** e.g. ['project'] to exclude 'agentic'; null = all tracks. */
    tracks: string[] | null;
    /** e.g. ['apps/srs-demo']; null = all domains. */
    domains: string[] | null;
  };
  output: {
    graph_file: string;
    pretty_print: boolean;
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
      const parsed = JSON.parse(content) as Partial<GraphRagConfig>;
      return { ...ConfigLoader.getDefault(), ...parsed } as GraphRagConfig;
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  static getDefault(): GraphRagConfig {
    return {
      focus: {
        title: 'Two-Axis Knowledge Graph',
        description: 'Stories/epics (time) + domains/concerns (workspace) from the compacted archive',
        created_at: '',
        updated_at: '',
      },
      root: '.',
      filter: {
        tracks: null,
        domains: null,
      },
      output: {
        graph_file: '.graph-data.json',
        pretty_print: true,
      },
    };
  }
}
