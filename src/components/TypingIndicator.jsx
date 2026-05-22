import styles from './TypingIndicator.module.css'

export default function TypingIndicator() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar}>NK</div>
      <div className={styles.bubble}>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
      </div>
    </div>
  )
}
