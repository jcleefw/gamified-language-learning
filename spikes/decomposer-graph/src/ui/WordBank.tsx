import type { GraphReader } from '../core/graph'
import styles from './WordBank.module.css'

interface WordBankProps {
  reader: GraphReader
  focus: string
  pathMode: boolean
  pathPicks: string[]
  onWordClick: (id: string) => void
}

export function WordBank({ reader, focus, pathMode, pathPicks, onWordClick }: WordBankProps) {
  return (
    <div className={styles.bankWrap}>
      <div className={styles.bank}>
        {reader.words().map((n) => {
          const isFocus = !pathMode && n.id === focus
          const isPick = pathMode && pathPicks.includes(n.id)
          const cls = [styles.chip, isFocus && styles.focus, isPick && styles.pathpick]
            .filter(Boolean)
            .join(' ')
          return (
            <button key={n.id} type="button" className={cls} onClick={() => onWordClick(n.id)}>
              {n.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
