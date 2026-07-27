import { useState } from 'react'
import { App } from './App'
import { LiveInput } from './LiveInput'
import { WORDS, type RawWord } from '../core'
import styles from './App.module.css'
import rootStyles from './Root.module.css'

function initialWords(): RawWord[] {
  return new URLSearchParams(window.location.search).has('empty') ? [] : WORDS
}

export function Root() {
  const [words, setWords] = useState<RawWord[]>(initialWords)

  const handleAddWord = (word: RawWord) => {
    setWords((prev) => [...prev, word])
  }

  if (words.length === 0) {
    return (
      <div className={styles.wrap}>
        <header className={rootStyles.header}>
          <h1 className={rootStyles.title}>หยาดเพชร</h1>
          <p className={rootStyles.subtitle}>Grapheme-role decomposer for Thai</p>
          <p className={rootStyles.description}>
            Build a knowledge graph one word at a time. Enter Thai text and watch it decompose into
            tones, consonant classes, vowels, and rules.
          </p>
        </header>
        <div className={rootStyles.formWrapper}>
          <LiveInput onAddWord={handleAddWord} />
        </div>
      </div>
    )
  }

  return <App initialWords={words} />
}
