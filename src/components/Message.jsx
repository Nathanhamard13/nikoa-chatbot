import ReactMarkdown from 'react-markdown'
import styles from './Message.module.css'

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Parse le contenu du bot pour extraire les blocs [CTA:Titre|url].
 * Retourne un tableau de segments : { type: 'text' | 'cta', value, title, url }
 */
function parseContent(raw) {
  const CTA_RE = /\[CTA:([^\|]+)\|([^\]]+)\]/g
  const segments = []
  let lastIndex = 0
  let match

  while ((match = CTA_RE.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: raw.slice(lastIndex, match.index).trim() })
    }
    segments.push({ type: 'cta', title: match[1].trim(), url: match[2].trim() })
    lastIndex = CTA_RE.lastIndex
  }

  if (lastIndex < raw.length) {
    const tail = raw.slice(lastIndex).trim()
    if (tail) segments.push({ type: 'text', value: tail })
  }

  return segments
}

function CTACard({ title, url, onCallback }) {
  const isCallback = url === '#callback' || url === 'CALLBACK_FORM'
  const isPhone    = url.startsWith('tel:')
  const isReset    = url === 'RESET' || url === 'reset'

  const handleClick = () => {
    if (isReset)    { window.location.reload(); return }
    if (isCallback) { onCallback?.(); return }
    if (isPhone)    { window.location.href = url; return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.ctaCard} onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}>
      <span className={styles.ctaTitle}>{title}</span>
      <span className={styles.ctaArrow}>›</span>
    </div>
  )
}

function ActionButtons({ actions }) {
  if (!actions || actions.length === 0) return null

  const handleClick = (action) => {
    if (!action.url) {
      window.location.reload()
      return
    }
    if (action.url.startsWith('tel:')) {
      window.location.href = action.url
      return
    }
    window.open(action.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.actionsRow}>
      {actions.map((action, i) => (
        <button key={i} type="button" className={styles.actionBtn}
          onClick={() => handleClick(action)}>
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default function Message({ message, onCallback }) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.userWrapper : styles.assistantWrapper}`}>
      {!isUser && <div className={styles.avatar}>NK</div>}
      <div className={styles.content}>
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
          {isUser
            ? message.content
            : (() => {
                const segments = parseContent(message.content)
                return segments.map((seg, i) =>
                  seg.type === 'cta'
                    ? <CTACard key={i} title={seg.title} url={seg.url} onCallback={onCallback} />
                    : seg.value
                      ? (
                        <ReactMarkdown
                          key={i}
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#4f46e5', textDecoration: 'underline' }} />
                            )
                          }}
                        >
                          {seg.value}
                        </ReactMarkdown>
                      )
                      : null
                )
              })()
          }
        </div>
        <ActionButtons actions={message.actions} />
        <span className={`${styles.time} ${isUser ? styles.timeRight : styles.timeLeft}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      {isUser && <div className={`${styles.avatar} ${styles.userAvatar}`}>Vous</div>}
    </div>
  )
}
