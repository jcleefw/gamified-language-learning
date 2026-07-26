import { describe, expect, it } from 'vitest'
import { composeSyllableText, decomposeGraphemes, type GraphemeException } from './graphemeParser'
import type { RawSyllable } from './types'

function isException(r: RawSyllable | GraphemeException): r is GraphemeException {
  return 'exception' in r
}

describe('decomposeGraphemes', () => {
  it('parses a plain long CV syllable', () => {
    expect(decomposeGraphemes('มา')).toEqual({
      initial: 'ม',
      vowel: '◌า',
      long: true,
      final: null,
      mark: null,
    })
  })

  it('reads ห นำ as a silent leader, not a cluster', () => {
    expect(decomposeGraphemes('หนึ่ง')).toEqual({
      initial: 'น',
      leadingSilent: 'ห',
      vowel: '◌ึ',
      long: false,
      final: 'ง',
      mark: 'ek',
    })
  })

  it('reads อ นำ as a silent leader only before ย', () => {
    expect(decomposeGraphemes('อย่า')).toEqual({
      initial: 'ย',
      leadingSilent: 'อ',
      vowel: '◌า',
      long: true,
      final: null,
      mark: 'ek',
    })
  })

  it('reads a true consonant cluster', () => {
    expect(decomposeGraphemes('เกล็ด')).toEqual({
      initial: 'ก',
      clusterConsonant: 'ล',
      vowel: 'เ◌็',
      long: false,
      final: 'ด',
      mark: null,
    })
  })

  it('does not misread ก+ว as a cluster when ว is actually the final', () => {
    expect(decomposeGraphemes('แก้ว')).toEqual({
      initial: 'ก',
      vowel: 'แ◌',
      long: true,
      final: 'ว',
      mark: 'tho',
    })
  })

  it('reduces สระอัว to ◌ว before a final consonant', () => {
    expect(decomposeGraphemes('ร่วง')).toEqual({
      initial: 'ร',
      vowel: '◌ัว',
      long: true,
      final: 'ง',
      mark: 'ek',
    })
  })

  it('reduces สระอือ to ◌ื before a final consonant', () => {
    expect(decomposeGraphemes('มืด')).toEqual({
      initial: 'ม',
      vowel: '◌ือ',
      long: true,
      final: 'ด',
      mark: null,
    })
  })

  it('reads an explicit การันต์ silent final', () => {
    expect(decomposeGraphemes('ศัลย์')).toEqual({
      initial: 'ศ',
      vowel: '◌ั',
      long: false,
      final: 'ล',
      mark: null,
      silentFinal: 'ย์',
    })
  })

  it('flags an unmarked silent final as an exception rather than guessing', () => {
    const result = decomposeGraphemes('เพชร')
    expect(isException(result)).toBe(true)
  })

  it('treats a bare เ◌ as long only when no final follows', () => {
    expect(decomposeGraphemes('เธอ')).toEqual({
      initial: 'ธ',
      vowel: 'เ◌อ',
      long: true,
      final: null,
      mark: null,
    })
    expect(decomposeGraphemes('เป')).toEqual({
      initial: 'ป',
      vowel: 'เ◌',
      long: true,
      final: null,
      mark: null,
    })
  })
})

describe('composeSyllableText', () => {
  const cases: [string, RawSyllable][] = [
    ['มา', { initial: 'ม', vowel: '◌า', long: true, final: null, mark: null }],
    [
      'หนึ่ง',
      { initial: 'น', leadingSilent: 'ห', vowel: '◌ึ', long: false, final: 'ง', mark: 'ek' },
    ],
    [
      'เกล็ด',
      { initial: 'ก', clusterConsonant: 'ล', vowel: 'เ◌็', long: false, final: 'ด', mark: null },
    ],
    ['ร่วง', { initial: 'ร', vowel: '◌ัว', long: true, final: 'ง', mark: 'ek' }],
    ['มืด', { initial: 'ม', vowel: '◌ือ', long: true, final: 'ด', mark: null }],
    [
      'ศัลย์',
      { initial: 'ศ', vowel: '◌ั', long: false, final: 'ล', mark: null, silentFinal: 'ย์' },
    ],
  ]

  it.each(cases)('renders %s from its RawSyllable fields', (text, syllable) => {
    expect(composeSyllableText(syllable)).toBe(text)
  })

  it('round-trips through decomposeGraphemes', () => {
    for (const [, syllable] of cases) {
      expect(decomposeGraphemes(composeSyllableText(syllable))).toEqual(syllable)
    }
  })
})
