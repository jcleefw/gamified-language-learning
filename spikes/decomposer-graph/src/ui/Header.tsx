import type { GraphReader } from '../core/graph'
import styles from './Header.module.css'
import { useTheme } from './useTheme'

const POEM = [
  'เปรียบเธอเพชรงามน้ำหนึ่ง หวานปานน้ำผึ้งเดือนห้า หยาดเพชรเกล็ดแก้วแววฟ้า ร่วงมาจากฟ้าหรือไร',
  'หยาดมาแล้วอย่าช้ำโศก ปล่อยคนทั้งโลกร้องไห้ หยาดเพชรเกล็ดแก้วผ่องใส นั้นอยู่ไกลเกินผูกพัน',
  'แม้ยามเพชรหยาดจากฟ้า ร่วงลงมาฟ้าคงไหวหวั่น ดวงดาวก็พลอยเศร้าโศกศัลย์ มิอาจกลั้นน้ำตาอาลัย',
  'เอื้อมมือคว้าหยาดเพชรแก้ว เผลอรักแล้วจึงฝันใฝ่ หยาดเพชรหยาดละอองผ่องใส แม้อยู่ในความมืดมน',
]

export function Header({ reader }: { reader: GraphReader }) {
  const [, toggleTheme] = useTheme()
  const { corpus, rulesetVersion } = reader.meta

  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.eyebrow}>Decomposer → Graph · spike</p>
          <h1 className={styles.title}>หยาดเพชร</h1>
          <p className={styles.subtitle}>
            This page is a <em>dumb reader</em>. All Thai lives in the typed core →{' '}
            <code>buildGraph()</code>; the renderer only knows <em>nodes</em> and <em>edges</em>.
            Edge thickness encodes <em>signal</em> — thin = shared by many words (weak), thick =
            specific (strong).
          </p>
        </div>
        <button className={styles.themeBtn} type="button" onClick={toggleTheme}>
          ◐ theme
        </button>
      </header>

      <div className={styles.poem}>
        {POEM.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <p className={styles.cred}>
          หยาดเพชร (poem) · {corpus} words · {reader.size} nodes · {rulesetVersion} · best-effort
          authored data — verify against a dictionary
        </p>
      </div>
    </>
  )
}
