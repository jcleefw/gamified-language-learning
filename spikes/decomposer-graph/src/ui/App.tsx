import { useCallback, useMemo, useState } from 'react'
import { buildGraph, loadGraphReader, type RawWord } from '../core/index'
import { GraphReader } from '../core/graph'
import styles from './App.module.css'
import { Controls } from './Controls'
import { GraphCanvas } from './GraphCanvas'
import type { Hl, Hop } from './graphView'
import { Header } from './Header'
import { Inspector } from './Inspector'
import { LiveInput } from './LiveInput'
import { WordBank } from './WordBank'

export interface AppState {
  focus: string
  hop: Hop
  hl: Hl
  pathMode: boolean
  pathPicks: string[]
}

interface AppProps {
  initialWords?: RawWord[]
}

export function App({ initialWords = [] }: AppProps) {
  const [words, setWords] = useState<RawWord[]>(initialWords)

  const reader = useMemo(() => {
    if (words.length === 0) {
      return loadGraphReader()
    }
    return new GraphReader(buildGraph(words), '2.0.0')
  }, [words])

  const initialFocus = useMemo(() => {
    const wordList = reader.words()
    return wordList.length > 0 ? wordList[0].id : ''
  }, [reader])

  const [state, setState] = useState<AppState>({
    focus: initialFocus,
    hop: 2,
    hl: 'rule',
    pathMode: false,
    pathPicks: [],
  })

  const onWordClick = useCallback((id: string) => {
    setState((s) => {
      if (!s.pathMode) return { ...s, focus: id }
      const picks = [...s.pathPicks]
      const i = picks.indexOf(id)
      if (i >= 0) picks.splice(i, 1)
      else {
        picks.push(id)
        if (picks.length > 2) picks.shift()
      }
      return { ...s, pathPicks: picks }
    })
  }, [])

  const setHop = useCallback((hop: Hop) => setState((s) => ({ ...s, hop })), [])
  const setHl = useCallback((hl: Hl) => setState((s) => ({ ...s, hl })), [])
  const setPathMode = useCallback(
    (pathMode: boolean) => setState((s) => ({ ...s, pathMode, pathPicks: [] })),
    [],
  )

  const handleAddWord = useCallback((word: RawWord) => {
    setWords((prev) => [...prev, word])
    setState((s) => ({ ...s, focus: 'W:' + word.thai }))
  }, [])

  return (
    <div className={styles.wrap}>
      <Header reader={reader} />

      <Controls
        hop={state.hop}
        hl={state.hl}
        pathMode={state.pathMode}
        onHop={setHop}
        onHl={setHl}
        onPathMode={setPathMode}
      />

      <WordBank
        reader={reader}
        focus={state.focus}
        pathMode={state.pathMode}
        pathPicks={state.pathPicks}
        onWordClick={onWordClick}
      />

      <div className={styles.main}>
        <GraphCanvas reader={reader} state={state} onWordClick={onWordClick} />
        <div className={styles.side}>
          <LiveInput onAddWord={handleAddWord} />
          <Inspector reader={reader} focus={state.focus} onWordClick={onWordClick} />
        </div>
      </div>

      <footer className={styles.footer}>
        <b>Pipeline.</b> input → <b>decompose</b> (tone computed, never guessed) → <b>graph</b>{' '}
        (nodes + typed edges) → the <b>Graph-RAG seam</b> (the retrieval blob an LLM would consume —
        shown, never sent). This renderer reads only nodes and edges.
        <br />
        <b>Signal.</b> each attribute node carries <code>signalBits = -log2(wordsCovered/corpus)</code>
        . A <em>class</em> edge (~1.5 bits) links half the corpus and says little; a{' '}
        <em>fired-rule</em> edge (~4 bits) is specific. Edge thickness shows it.
      </footer>
    </div>
  )
}
