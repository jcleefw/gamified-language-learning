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
      str += `- [${node.type.toUpperCase()}] ${node.label}\n`;
      if (node.metadata?.summary) {
        const summary = String(node.metadata.summary).substring(0, 200);
        str += `  Summary: ${summary}${String(node.metadata.summary).length > 200 ? '...' : ''}\n`;
      }
      if (node.metadata?.notes) {
        const notes = String(node.metadata.notes).substring(0, 200);
        str += `  Notes: ${notes}${String(node.metadata.notes).length > 200 ? '...' : ''}\n`;
      }
      if (node.metadata?.domain) str += `  Domain: ${node.metadata.domain}\n`;
      if (node.metadata?.pr) str += `  PR: #${node.metadata.pr}\n`;
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

    const systemPrompt = `You are an expert in software project history and architecture.
You have access to a two-axis knowledge graph of a language-learning platform:
- a TIME axis of stories and epics (completed units of work), and
- a DOMAIN axis of workspace units and the concerns within them.
Provenance edges ('sources') connect a domain's current state back to the stories/epics that produced it.
Answer questions about the project's development, architecture, and evolution from the graph context provided.
Be specific: reference story/epic IDs, workspace domains, and PR numbers when available.
Group your reasoning by domain, not by epic — an epic is a unit of work in time, not a unit of knowledge.`;

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
        m.summary,
        m.notes,
        m.concern,
        m.domain,
        Array.isArray(m.domains) ? m.domains.join(' ') : undefined,
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
