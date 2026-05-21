import { useState, useRef } from 'react'
import styles from './CallbackForm.module.css'

export default function CallbackForm({ onSuccess, onClose, getConversation }) {
  const [prenom,    setPrenom]    = useState('')
  const [telephone, setTelephone] = useState('')
  const [moment,    setMoment]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const submittedRef = useRef(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation client
    if (!prenom.trim())    return setError('Votre prénom est requis.')
    if (!telephone.trim()) return setError('Votre numéro de téléphone est requis.')

    // Validation basique du téléphone côté client
    const telClean = telephone.trim().replace(/[\s\-\.()+]/g, '')
    if (!/^(0[1-9]\d{8}|33[1-9]\d{8})$/.test(telClean))
      return setError('Numéro invalide. Exemple : 06 12 34 56 78')

    // Protection double-submit
    if (submittedRef.current) return
    submittedRef.current = true
    setLoading(true)

    try {
      const res = await fetch('/api/callback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom:       prenom.trim().slice(0, 100),
          telephone:    telephone.trim(),
          moment:       moment.trim().slice(0, 500),
          conversation: getConversation(),
          website:      '',   // honeypot — toujours vide côté humain
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')

      onSuccess(telephone.trim())
    } catch (err) {
      submittedRef.current = false   // permet de réessayer si erreur réseau
      setError(err.message || 'Une erreur est survenue. Contactez-nous sur nikoa.fr/contact.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar}>NK</div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Votre projet avec NIKOA</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* Honeypot anti-bot — caché visuellement */}
          <div style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}
            aria-hidden="true">
            <label htmlFor="cb_website">Ne pas remplir</label>
            <input
              id="cb_website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Prénom <span className={styles.req}>*</span></label>
            <input
              type="text"
              className={styles.input}
              placeholder="Votre prénom ou nom"
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
              disabled={loading}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Téléphone <span className={styles.req}>*</span></label>
            <input
              type="tel"
              className={styles.input}
              placeholder="06 12 34 56 78"
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              disabled={loading}
              maxLength={20}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Meilleur moment pour vous appeler ?</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ex : demain matin, après 14h…"
              value={moment}
              onChange={e => setMoment(e.target.value)}
              disabled={loading}
              maxLength={200}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loadingDots}>
                <span/><span/><span/>
              </span>
            ) : 'Envoyer ma demande'}
          </button>
        </form>
      </div>
    </div>
  )
}
