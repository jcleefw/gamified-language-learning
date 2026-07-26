import { describe, expect, it } from 'vitest'
import { buildGraph, computeTone, decompose, WORDS } from './index'
import type { RawWord } from './types'

describe('computeTone', () => {
  it('applies tone marks over class rules', () => {
    expect(computeTone('low', 'ek', true, true)).toBe('falling')
    expect(computeTone('high', 'ek', true, true)).toBe('low')
    expect(computeTone('low', 'tho', false, false)).toBe('high')
    expect(computeTone('mid', 'tri', true, true)).toBe('high')
    expect(computeTone('mid', 'chattawa', true, true)).toBe('rising')
  })

  it('derives tone from class + liveness when unmarked', () => {
    expect(computeTone('mid', null, true, true)).toBe('mid')
    expect(computeTone('mid', null, false, false)).toBe('low')
    expect(computeTone('high', null, true, true)).toBe('rising')
    expect(computeTone('high', null, false, false)).toBe('low')
    expect(computeTone('low', null, true, true)).toBe('mid')
    expect(computeTone('low', null, false, true)).toBe('falling')
    expect(computeTone('low', null, false, false)).toBe('high')
  })
})

describe('decompose', () => {
  it('reads a silent leader for its class, not the initial', () => {
    const one: RawWord = {
      thai: 'หนึ่ง',
      romanization: 'nùng',
      gloss: 'one',
      field: ['number'],
      note: 'ห นำ (silent leader)',
      syllables: [
        { initial: 'น', leadingSilent: 'ห', vowel: '◌ึ', long: false, final: 'ง', mark: 'ek' },
      ],
    }
    const d = decompose(one)
    expect(d.syllables[0].class).toBe('high') // ห is high, not low น
    expect(d.syllables[0].tone).toBe('low')
    expect(d.status).toBe('exception')
  })

  it('honours forceTone for irregulars and flags the override', () => {
    const kaw = WORDS.find((w) => w.thai === 'ก็')!
    const d = decompose(kaw)
    expect(d.syllables[0].tone).toBe('falling')
    expect(d.syllables[0].overridden).toBe(true)
  })
})

describe('buildGraph', () => {
  it('emits a connected typed graph with signal on attribute nodes', () => {
    const g = buildGraph(WORDS)
    expect(g.corpus).toBe(WORDS.length)
    expect(g.nodes.some((n) => n.type === 'word')).toBe(true)
    const attr = g.nodes.find((n) => n.type === 'rule')!
    expect(attr.signalBits).toBeGreaterThan(0)
    expect(attr.wordsCovered).toBeGreaterThan(0)
  })
})
