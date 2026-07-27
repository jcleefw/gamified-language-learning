import { useState } from 'react'
import { decompose, type RawWord } from '../core'
import styles from './LiveInput.module.css'

interface LiveInputProps {
  onAddWord: (word: RawWord) => void
}

export function LiveInput({ onAddWord }: LiveInputProps) {
  const [thai, setThai] = useState('')
  const [gloss, setGloss] = useState('')
  const [field, setField] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!thai.trim()) {
      setError('Thai text is required')
      return
    }

    // The parser only decomposes one already-segmented syllable at a time — it
    // deliberately never guesses word-internal boundaries (see spike plan). For
    // multi-syllable words, the user marks boundaries explicitly with ·.
    const syllableTexts = thai
      .trim()
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean)

    // Romanization is computed by decompose() (Layer 1) — no manual entry.
    const word: RawWord = {
      thai: syllableTexts.join(''),
      gloss: gloss.trim() || 'unknown',
      field: field.trim() ? field.trim().split(',').map((f) => f.trim()) : ['unlabeled'],
      syllables: syllableTexts.map((s) => ({ thai: s })),
    }

    // Test decomposition
    const decomposed = decompose(word)
    if (decomposed.status === 'exception') {
      setError(`Parse failed: ${decomposed.exception}`)
      return
    }

    onAddWord(word)
    setThai('')
    setGloss('')
    setField('')
  }

  return (
    <div className={styles.liveInput}>
      <h3>Add Word</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.group}>
          <label htmlFor="thai">Thai text *</label>
          <input
            id="thai"
            type="text"
            value={thai}
            onChange={(e) => setThai(e.target.value)}
            placeholder="เช่น เธอ — multi-syllable: สับ·ดา·ห์"
            required
          />
          <p className={styles.hint}>
            Multi-syllable word? Mark boundaries with · (the parser reads one syllable at a
            time and never guesses where they split).
          </p>
        </div>

        <div className={styles.group}>
          <label htmlFor="gloss">Meaning</label>
          <input
            id="gloss"
            type="text"
            value={gloss}
            onChange={(e) => setGloss(e.target.value)}
            placeholder="English meaning"
          />
        </div>

        <div className={styles.group}>
          <label htmlFor="field">Field (comma-separated)</label>
          <input
            id="field"
            type="text"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="e.g., voice, quality"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submit}>
          Add Word
        </button>
      </form>
    </div>
  )
}
