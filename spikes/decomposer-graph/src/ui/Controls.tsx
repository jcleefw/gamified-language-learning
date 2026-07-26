import styles from './Controls.module.css'
import type { Hl, Hop } from './graphView'

interface ControlsProps {
  hop: Hop
  hl: Hl
  pathMode: boolean
  onHop: (hop: Hop) => void
  onHl: (hl: Hl) => void
  onPathMode: (on: boolean) => void
}

const HOPS: { value: Hop; label: string }[] = [
  { value: 1, label: '1 · decompose' },
  { value: 2, label: '2 · neighbours' },
  { value: 3, label: '3 · +their parts' },
]

const HLS: { value: Hl; label: string }[] = [
  { value: 'rule', label: 'fired rule' },
  { value: 'initial', label: 'consonant' },
  { value: 'class', label: 'class' },
  { value: 'tone', label: 'tone' },
  { value: 'field', label: 'field' },
  { value: 'none', label: 'none' },
]

function Seg<T extends string | number>({
  options,
  active,
  onPick,
}: {
  options: { value: T; label: string }[]
  active: T
  onPick: (value: T) => void
}) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === active ? styles.on : undefined}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Controls({ hop, hl, pathMode, onHop, onHl, onPathMode }: ControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.group}>
        <span className={styles.label}>Hops</span>
        <Seg options={HOPS} active={hop} onPick={onHop} />
      </div>
      <div className={styles.group}>
        <span className={styles.label}>Highlight relation</span>
        <Seg options={HLS} active={hl} onPick={onHl} />
      </div>
      <div className={styles.group}>
        <span className={styles.label}>Path</span>
        <Seg
          options={[
            { value: 'off', label: 'off' },
            { value: 'on', label: 'pick 2 words' },
          ]}
          active={pathMode ? 'on' : 'off'}
          onPick={(v) => onPathMode(v === 'on')}
        />
      </div>
    </div>
  )
}
