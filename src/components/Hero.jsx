import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>RL</div>
          <span className={styles.name}>Sophie</span>
        </div>
        <div className={styles.text}>
          <h2 className={styles.title}>Bonjour, je suis Sophie, votre assistante virtuelle.</h2>
          <p className={styles.subtitle}>Posez-moi vos questions — je suis là pour vous aider.</p>
        </div>
      </div>
    </section>
  )
}
