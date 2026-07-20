import Anthropic from '@anthropic-ai/sdk';
import type { Node, Edge, GraphContext, QueryResult } from './types.js';
import { ProjectGraph } from './graph.js';

export class QueryEngine {
  graph: ProjectGraph;
  client: Anthropic;

  constructor(graph: ProjectGraph, apiKey?: string) {
    this.graph = graph;
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  // Extract relevant context for a query
  getContext(query: string): GraphContext {
    const relevantNodes = this.searchNodes(query);
    const nodeIds = relevantNodes.map((n) => n.id);
    const subgraph = this.buildSubgraph(nodeIds, 3);

    return {
      query,
      relevantNodes,
      subgraph,
      graphStats: {
        totalNodes: this.graph.nodes.size,
        totalEdges: this.graph.edges.length,
        nodeTypes: this.graph['_countByType']?.() || {},
      },
    };
  }

  // Convert context to a string for LLM
  contextToString(context: GraphContext): string {
    let str = `GRAPH CONTEXT FOR QUERY: "${context.query}"\n`;
    str += `${'='.repeat(60)}\n\n`;

    str += `GRAPH OVERVIEW:\n`;
    str += `- Total nodes: ${context.graphStats.totalNodes}\n`;
    str += `- Total edges: ${context.graphStats.totalEdges}\n`;
    str += `- Node types: ${Object.entries(context.graphStats.nodeTypes)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ')}\n\n`;

    str += `RELEVANT NODES (for your query):\n`;
    context.relevantNodes.forEach((node) => {
      const m = node.metadata ?? {};
      str += `- [${node.type.toUpperCase()}] ${node.label}\n`;
      if (m.content) {
        str += `  Knowledge:\n`;
        String(m.content)
          .split('\n')
          .forEach((line) => (str += `    ${line}\n`));
      }
      if (Array.isArray(m.sources) && m.sources.length) {
        str += `  Produced by: ${m.sources.join(', ')}`;
        if (Array.isArray(m.epics) && m.epics.length) str += ` (epic ${m.epics.join(', ')})`;
        if (Array.isArray(m.prs) && m.prs.length) str += ` — PR ${m.prs.map((p) => `#${p}`).join(', ')}`;
        str += `\n`;
      }
    });

    str += `\nRELATIONSHIP SUBGRAPH (related nodes & edges):\n`;
    str += `Nodes (${context.subgraph.nodes.length}):\n`;
    context.subgraph.nodes.slice(0, 20).forEach((node) => {
      str += `  • [${node.type}] ${node.label}\n`;
    });
    if (context.subgraph.nodes.length > 20) {
      str += `  ... and ${context.subgraph.nodes.length - 20} more\n`;
    }

    str += `\nEdges (${context.subgraph.edges.length}):\n`;
    context.subgraph.edges.slice(0, 20).forEach((edge) => {
      const from = this.graph.getNode(edge.from);
      const to = this.graph.getNode(edge.to);
      str += `  • ${from?.label || edge.from} --[${edge.type}]--> ${to?.label || edge.to}\n`;
    });
    if (context.subgraph.edges.length > 20) {
      str += `  ... and ${context.subgraph.edges.length - 20} more\n`;
    }

    return str;
  }

  // Query with LLM reasoning
  async query(question: string): Promise<QueryResult> {
    const context = this.getContext(question);
    const contextStr = this.contextToString(context);

    const systemPrompt = `You are an expert in a software project's architecture.
You read a knowledge graph of a language-learning platform organized by KNOWLEDGE, not by work:
- domain nodes are workspace units (apps/*, packages/*),
- ryoiki nodes are named areas of knowledge within a domain, each carrying the durable
  description of how that area works,
- adr nodes are architecture DECISIONS (the *why*): a 'decides' edge points from an ADR to the
  ryoiki/domain it governs, and a 'supersedes' edge from a newer ADR to the one it replaces.
  An ADR with no 'decides' edge is a decision not yet realized in a ryoiki.
Each ryoiki also records its provenance — the stories/epics/PRs that produced it — as
metadata, so you can cite the work without treating it as the structure.
Answer from the ryoiki knowledge in the context. Be specific: name the domain and ryoiki,
quote what the knowledge says, cite the producing story/epic IDs and PR numbers when asked
"what produced this?", and cite the governing ADR (and its status) when asked "why?".
Do not organize your answer around epics — organize it around ryoiki.`;

    const userPrompt = `Based on the project graph below, answer this question:\n\n${question}\n\n---\n\n${contextStr}`;

    const response = await this.client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const answer =
      response.content[0].type === 'text' ? response.content[0].text : 'No response generated';

    return {
      query: question,
      answer,
      context: contextStr,
      nodes: context.relevantNodes,
      edges: context.subgraph.edges,
    };
  }

  // Search nodes by text
  private searchNodes(query: string): Node[] {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const searchableText = (node: Node): string => {
      const m = node.metadata ?? {};
      const parts = [
        node.label,
        m.content, // the ryoiki's durable knowledge prose (or an ADR's body)
        m.ryoiki,
        m.unit,
        m.status, // adr: Accepted / Superseded / Proposed
        m.scope, // adr: what the decision covers
        Array.isArray(m.sources) ? m.sources.join(' ') : undefined, // provenance ids
        Array.isArray(m.epics) ? m.epics.join(' ') : undefined,
      ];
      return parts.filter(Boolean).join(' ').toLowerCase();
    };

    const scored = Array.from(this.graph.nodes.values())
      .map((node) => {
        const text = searchableText(node);
        const matches = keywords.filter((k) => text.includes(k)).length;
        return { node, score: matches };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 10).map((x) => x.node);
  }

  // Build subgraph from node IDs
  private buildSubgraph(nodeIds: string[], depth: number) {
    const visited = new Set(nodeIds);
    const queue = [...nodeIds];
    const subgraphEdges: Edge[] = [];

    let d = 0;
    while (queue.length > 0 && d < depth) {
      const nextQueue: string[] = [];
      queue.forEach((nodeId) => {
        this.graph.edges.forEach((edge) => {
          if (edge.from === nodeId && !visited.has(edge.to)) {
            visited.add(edge.to);
            nextQueue.push(edge.to);
            subgraphEdges.push(edge);
          }
        });
      });
      queue.length = 0;
      queue.push(...nextQueue);
      d++;
    }

    return {
      nodes: Array.from(visited).map((id) => this.graph.getNode(id)!),
      edges: subgraphEdges,
    };
  }
}
