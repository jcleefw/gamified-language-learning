import wordsJson from '../../data/words.json'
import { buildGraph, RULESET_VERSION } from './decomposer'
import { GraphReader } from './graph'
import type { RawWord } from './types'

export * from './types'
export { buildGraph, computeTone, decompose, liveness, RELATIONS, RULESET_VERSION } from './decomposer'
export { GraphReader } from './graph'
export type { Adjacency } from './graph'

export const WORDS = wordsJson as RawWord[]

/** Build the graph from the authored corpus and wrap it in a reader. */
export function loadGraphReader(): GraphReader {
  return new GraphReader(buildGraph(WORDS), RULESET_VERSION)
}
