import { describe, expect, it } from 'vitest'
import { buildGraph, computeRomanization, computeTone, decompose, WORDS } from './index'
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

  it('wires the parser for live input syllables (Thai text only)', () => {
    const liveWord: RawWord = {
      thai: 'เธอ',
      romanization: 'thəə',
      gloss: 'you',
      field: ['voice'],
      syllables: [{ thai: 'เธอ' }],
    }
    const d = decompose(liveWord)
    expect(d.status).toBe('clean')
    expect(d.syllables).toHaveLength(1)
    const s = d.syllables[0]
    expect(s.initial).toBe('ธ')
    expect(s.vowel).toBe('เ◌อ')
    expect(s.long).toBe(true)
    expect(s.tone).toBe('mid')
  })

  it('handles parse exceptions gracefully in live input', () => {
    const invalidWord: RawWord = {
      thai: 'xyz',
      romanization: 'xyz',
      gloss: 'invalid',
      field: ['test'],
      syllables: [{ thai: 'xyz' }],
    }
    const d = decompose(invalidWord)
    expect(d.status).toBe('exception')
    expect(d.exception).toContain('Parse:')
    expect(d.syllables).toHaveLength(0)
  })
})

describe('computeRomanization (Layer 1)', () => {
  it('places the tone diacritic on the first vowel letter', () => {
    // แก้ว: ก(mid) + แ◌(ɛɛ) + ว coda, tho on mid → falling → circumflex on first ɛ
    expect(computeRomanization(
      { initial: 'ก', vowel: 'แ◌', long: true, final: 'ว', mark: 'tho' },
      'falling',
    )).toBe('kɛ̂ɛw') // kɛ̂ɛw
    // ผึ้ง: ผ(high) + ◌ึ(ʉ) + ง coda, tho on high → falling → circumflex on ʉ
    expect(computeRomanization(
      { initial: 'ผ', vowel: '◌ึ', long: false, final: 'ง', mark: 'tho' },
      'falling',
    )).toBe('phʉ̂ng') // phʉ̂ng
  })

  it('does not romanize the silent ห/อ leader (uses the initial for the onset)', () => {
    // หนึ่ง: ห silent, น onset → n; low tone → grave. (Authored 'nùng' spells ◌ึ as 'u';
    // the rule spells it 'ʉ' — an audit mismatch, tracked in validate-romanization.)
    expect(computeRomanization(
      { initial: 'น', leadingSilent: 'ห', vowel: '◌ึ', long: false, final: 'ง', mark: 'ek' },
      'low',
    )).toBe('nʉ̀ng') // nʉ̀ng
  })

  it('does not romanize a การันต์ silent final; a live-syllable final maps to its coda', () => {
    // ศัลย์: ศ→s, ◌ั→a, final ล→n (sonorant), ย์ silent; rising → caron
    expect(computeRomanization(
      { initial: 'ศ', vowel: '◌ั', long: false, final: 'ล', mark: null, silentFinal: 'ย์' },
      'rising',
    )).toBe('sǎn') // sǎn
  })

  it('is exposed on the decomposed word, joining syllables with "-"', () => {
    const thoe: RawWord = { thai: 'เธอ', gloss: 'you', field: ['voice'], syllables: [{ thai: 'เธอ' }] }
    expect(decompose(thoe).romanization).toBe('thəə') // thəə (mid, no diacritic)

    // ละออง: ล+◌ะ (high, dead-short) → lá ; อ zero onset + ◌อ(ɔɔ) + ง → ɔɔng
    const laong: RawWord = {
      thai: 'ละออง',
      gloss: 'fine mist',
      field: ['nature'],
      syllables: [
        { initial: 'ล', vowel: '◌ะ', long: false, final: null, mark: null },
        { initial: 'อ', vowel: '◌อ', long: true, final: 'ง', mark: null },
      ],
    }
    expect(decompose(laong).romanization).toBe('lá-ɔɔng') // lá-ɔɔng
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

  it('builds a graph from live input words with computed syllables', () => {
    const liveWords: RawWord[] = [
      { thai: 'เธอ', romanization: 'thəə', gloss: 'you', field: ['voice'], syllables: [{ thai: 'เธอ' }] },
      { thai: 'งาม', romanization: 'ngaam', gloss: 'lovely', field: ['quality'], syllables: [{ thai: 'งาม' }] },
    ]
    const g = buildGraph(liveWords)
    expect(g.corpus).toBe(2)
    expect(g.nodes.filter((n) => n.type === 'word')).toHaveLength(2)
    expect(g.edges.length).toBeGreaterThan(0)
  })

  it('handles empty word list gracefully', () => {
    const g = buildGraph([])
    expect(g.corpus).toBe(0)
    expect(g.nodes).toHaveLength(0)
    expect(g.edges).toHaveLength(0)
  })
})
