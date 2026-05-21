import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoBlock}>
            <span className={styles.logoName}>Relya</span>
            <span className={styles.logoSub}>Expertise Comptable · Audit · Conseil</span>
            <span className={styles.slogan}>À vos côtés pour entreprendre</span>
          </div>
        </div>
        <div className={styles.status}>
          <span className={styles.dot} aria-hidden="true"></span>
          <span className={styles.statusText}>En ligne</span>
        </div>
      </div>
    </header>
  )
}
