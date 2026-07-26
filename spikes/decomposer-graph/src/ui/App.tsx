import { useCallback, useMemo, useState } from 'react'
import { loadGraphReader } from '../core/index'
import styles from './App.module.css'
import { Controls } from './Controls'
import { GraphCanvas } from './GraphCanvas'
import type { Hl, Hop } from './graphView'
import { Header } from './Header'
import { Inspector } from './Inspector'
import { WordBank } from './WordBank'

export interface AppState {
  focus: string
  hop: Hop
  hl: Hl
  pathMode: boolean
  pathPicks: string[]
}

export function App() {
  const reader = useMemo(() => loadGraphReader(), [])

  const initialFocus = useMemo(
    () => (reader.has('W:แก้ว') ? 'W:แก้ว' : reader.words()[0].id),
    [reader],
  )

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
        <Inspector reader={reader} focus={state.focus} onWordClick={onWordClick} />
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
