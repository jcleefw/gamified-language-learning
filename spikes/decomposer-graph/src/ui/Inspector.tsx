import type { ReactNode } from 'react'
import type { GraphReader } from '../core/graph'
import type { DecomposedWord, RelationKey } from '../core/types'
import styles from './Inspector.module.css'

interface InspectorProps {
  reader: GraphReader
  focus: string
  onWordClick: (id: string) => void
}

const REL_GROUPS: { rel: RelationKey; cssVar: string }[] = [
  { rel: 'has-initial', cssVar: '--n-consonant' },
  { rel: 'fired-rule', cssVar: '--n-rule' },
  { rel: 'has-class', cssVar: '--n-class' },
  { rel: 'has-tone', cssVar: '--n-tone' },
  { rel: 'in-field', cssVar: '--n-field' },
]

/** Renders "…→ FALLING" with the trailing tone word in a highlighted chip. */
function ruleLabel(label: string): ReactNode {
  const m = label.match(/^(.*→ )(\w+)$/)
  if (!m) return label
  return (
    <>
      {m[1]}
      <span className={styles.toneChip}>{m[2]} tone</span>
    </>
  )
}

export function Inspector({ reader, focus, onWordClick }: InspectorProps) {
  const nd = reader.node(focus)
  const d = nd.word
  if (!d) return null

  return (
    <div className={styles.inspector}>
      <div className={styles.card}>
        <div className={styles.focusWord}>
          <span className={styles.th}>{d.thai}</span>
          <span className={styles.rom}>{d.romanization}</span>
          <span className={styles.gloss}>‘{d.gloss}’</span>
          <span className={`${styles.status} ${d.status === 'clean' ? styles.clean : styles.exception}`}>
            {d.status}
          </span>
        </div>
        {d.exception && (
          <div className={styles.exceptionNote}>⚠ {d.exception} — still decomposes, flagged irregular.</div>
        )}
        {d.syllables.map((s, i) => (
          <div className={styles.syl} key={i}>
            <div className={styles.graphemes}>
              {s.graphemes.map((g, j) => (
                <div className={`${styles.g}${g.silent ? ' ' + styles.silent : ''}`} key={j}>
                  <span className={styles.gl}>{g.glyph}</span>
                  <span className={styles.role}>{g.role}</span>
                </div>
              ))}
            </div>
            <div className={styles.derive}>
              class <b>{s.class.toUpperCase()}</b>
              {s.leadingSilent && <span className={styles.leader}> (from {s.leadingSilent} leader)</span>}{' '}
              · syllable <b>{s.syllableType.toUpperCase()}</b> · mark <b>{s.toneMarkName || 'none'}</b>
            </div>
            <div className={styles.ruleFired}>
              <div className={styles.lbl}>
                ▶ fired rule{d.syllables.length > 1 ? ` · syllable ${i + 1}` : ''}
              </div>
              <div className={styles.body}>{ruleLabel(s.firedRuleLabel)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <h3>Neighbourhood · connected words</h3>
        {REL_GROUPS.map(({ rel, cssVar }) => (
          <RelGroup
            key={rel}
            reader={reader}
            focus={focus}
            rel={rel}
            cssVar={cssVar}
            onWordClick={onWordClick}
          />
        ))}
      </div>

      <Seam reader={reader} focus={focus} word={d} />
    </div>
  )
}

function RelGroup({
  reader,
  focus,
  rel,
  cssVar,
  onWordClick,
}: {
  reader: GraphReader
  focus: string
  rel: RelationKey
  cssVar: string
  onWordClick: (id: string) => void
}) {
  const words = [...reader.relatedWords(focus, [rel]).keys()]
  if (!words.length) return null
  const attrId = reader.neighbours(focus).find((n) => n.rel === rel)?.to
  const attr = attrId ? reader.node(attrId) : null
  const info = reader.meta.relations[rel]

  return (
    <div className={styles.relGroup}>
      <div className={styles.relHead}>
        <i style={{ background: `var(${cssVar})` }} />
        {info.label} <span className={styles.sig}>· {words.length}</span>
        {attr && attr.signalBits != null && <span className={styles.bits}>{attr.signalBits} bits</span>}
      </div>
      <div className={styles.relWords}>
        {words.map((id) => (
          <button key={id} type="button" onClick={() => onWordClick(id)}>
            {reader.node(id).label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Seam({
  reader,
  focus,
  word: d,
}: {
  reader: GraphReader
  focus: string
  word: DecomposedWord
}) {
  const k = (t: string) => <span className={styles.k}>{t}</span>
  const rules = reader
    .neighbours(focus)
    .filter((n) => n.rel === 'fired-rule')
    .map((n) => reader.node(n.to).label)
  const sameRule = [...reader.relatedWords(focus, ['fired-rule']).keys()].map((id) => reader.node(id).label)
  const sameField = [...reader.relatedWords(focus, ['in-field']).keys()].map((id) => reader.node(id).label)
  const decomp = d.syllables
    .map((s) => `  ${s.class}·${s.toneMarkName || 'no-mark'}·${s.syllableType} → ${s.tone}`)
    .join('\n')

  return (
    <div className={`${styles.card} ${styles.seam}`}>
      <h3>⟶ Graph-RAG seam</h3>
      <p className={styles.note}>
        The retrieval context a model would consume. The graph built it; no model is called.
      </p>
      <div className={styles.blob}>
        {k('focus')}: {d.thai} “{d.gloss}” /{d.romanization}/{'\n'}
        {k('decomposition')}:{'\n'}
        {decomp}
        {'\n'}
        {k('fired_rules')}: {rules.join(' ; ')}
        {'\n'}
        {k('retrieved_neighbours')}:{'\n'}
        {`  same_rule[${sameRule.length}]: ${sameRule.join(' ') || '—'}`}
        {'\n'}
        {`  same_field[${sameField.length}]: ${sameField.join(' ') || '—'}`}
        {'\n'}
        {k('instruction')}: “Explain why {d.thai} carries {d.syllables.map((s) => s.tone).join('+')} tone,
        {'\n'}
        {'  then connect it to the retrieved neighbours that work the same way.”'}
      </div>
      <div className={styles.stopbar}>
        <span>graph stops here</span>
        <span className={styles.bar} />
        <span>RAG would begin</span>
      </div>
    </div>
  )
}
