import styles from './QuickSuggestions.module.css'

const SUGGESTIONS = [
  '1 · Cabinet comptable',
  '2 · Médical / paramédical',
  '3 · E-commerce',
  '4 · Artisan / PME locale',
]

export default function QuickSuggestions({ onSelect }) {
  return (
    <div className={styles.container}>
      <p className={styles.label}>Questions fréquentes</p>
      <div className={styles.grid}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className={styles.chip} onClick={() => onSelect(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
