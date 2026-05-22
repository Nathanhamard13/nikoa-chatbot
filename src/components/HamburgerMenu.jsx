import { useState, useEffect, useRef } from 'react'
import styles from './HamburgerMenu.module.css'

function PhoneCallIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#FF0057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      <polyline points="17 1 21 5 17 9"/>
      <line x1="21" y1="5" x2="13" y2="5"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#555555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#555555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#555555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

function CloseMenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>
  )
}

const MENU_ITEMS = [
  {
    icon: <PhoneCallIcon />,
    label: 'Mettre ce chatbot sur mon site',
    action: 'callback',
    value: null,
  },
  {
    icon: <GlobeIcon />,
    label: 'Voir nos réalisations',
    action: 'url',
    value: 'https://nikoa.fr/realisations',
  },
  {
    icon: <FileTextIcon />,
    label: 'Demander un devis',
    action: 'url',
    value: 'https://nikoa.fr/contact',
  },
  {
    icon: <RefreshIcon />,
    label: 'Recommencer la démo',
    action: 'reset',
    value: null,
  },
]

export default function HamburgerMenu({ onCallback }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  const handleItem = (item) => {
    setIsOpen(false)
    if (item.action === 'callback') {
      onCallback?.()
    } else if (item.action === 'url') {
      window.open(item.value, '_blank', 'noopener,noreferrer')
    } else if (item.action === 'reset') {
      window.location.reload()
    }
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseMenuIcon /> : <MenuIcon />}
      </button>

      {isOpen && (
        <div className={styles.popup} role="menu">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={i}
              type="button"
              className={[
                styles.item,
                i === 0                     ? styles.itemFirst    : '',
                i === MENU_ITEMS.length - 1 ? styles.itemLast     : '',
                i < MENU_ITEMS.length - 1   ? styles.itemDivider  : '',
                i === 0                     ? styles.itemCallback  : '',
              ].join(' ')}
              onClick={() => handleItem(item)}
              role="menuitem"
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
