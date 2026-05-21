import { useState, useEffect, useRef, useCallback } from 'react'
import Message from './components/Message'
import TypingIndicator from './components/TypingIndicator'
import QuickSuggestions from './components/QuickSuggestions'
import HamburgerMenu from './components/HamburgerMenu'
import CallbackForm from './components/CallbackForm'
import styles from './App.module.css'

const MAX_USER_MESSAGES = 10

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: `Bienvenue dans la démo NIKOA.

Choisissez votre secteur pour vivre exactement l'expérience que vos clients auraient :

**1** · Cabinet comptable ou juridique
**2** · Médical ou paramédical
**3** · E-commerce ou boutique en ligne
**4** · Artisan ou PME locale

Tapez le numéro de votre choix.`,
  timestamp: new Date(),
}

const ERROR_TEXT = 'Je rencontre un problème technique. Contactez-nous sur nikoa.fr/contact.'

const SPEECH_PHRASES = [
  'Un chatbot IA sur votre site — démo en direct.',
  'Vos clients répondus 24h/24, même le dimanche.',
  "Choisissez votre secteur et vivez l'expérience.",
  'Agence web & IA basée à Vitré, Bretagne.',
  'Transformez votre site en commercial disponible H24.',
]

const BUBBLE_CLOSED_KEY = 'nikoa_bubble_closed'

function parseAssistantResponse(raw) {
  const match = raw.match(/([\s\S]*?)(\{[\s\S]*?"actions"\s*:[\s\S]*?\})\s*$/)
  if (!match) return { text: raw.trim(), actions: [] }
  try {
    const parsed = JSON.parse(match[2])
    return { text: match[1].trim(), actions: Array.isArray(parsed.actions) ? parsed.actions : [] }
  } catch {
    return { text: raw.trim(), actions: [] }
  }
}

/* ── SVG Icons ────────────────────────────────── */
function ChatBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function CloseXIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

/* ── SpeechBubble ─────────────────────────────── */
function SpeechBubble({ onClose, onOpen }) {
  const [phraseIndex,   setPhraseIndex]   = useState(0)
  const [phraseVisible, setPhraseVisible] = useState(true)

  // Rotation des phrases toutes les 5 secondes avec fade
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseVisible(false)
      setTimeout(() => {
        setPhraseIndex(i => (i + 1) % SPEECH_PHRASES.length)
        setPhraseVisible(true)
      }, 420)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={styles.speechBubble}
      role="button"
      aria-label="Ouvrir le chat"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen()}
    >
      <button
        className={styles.speechClose}
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label="Fermer"
        type="button"
      >
        <CloseXIcon size={11} color="#999" />
      </button>
      <p className={`${styles.speechText} ${phraseVisible ? '' : styles.speechTextHidden}`}>
        {SPEECH_PHRASES[phraseIndex]}
      </p>
    </div>
  )
}

/* ── App ──────────────────────────────────────── */
export default function App() {
  const [isOpen,            setIsOpen]            = useState(false)
  const [hasUnread,         setHasUnread]         = useState(false)
  const [messages,          setMessages]          = useState([])
  const [input,             setInput]             = useState('')
  const [isTyping,          setIsTyping]          = useState(false)
  const [showSuggestions,   setShowSuggestions]   = useState(true)
  const [hasUserSent,       setHasUserSent]       = useState(false)
  const [userMsgCount,      setUserMsgCount]      = useState(0)
  const [showCallbackForm,  setShowCallbackForm]  = useState(false)
  const [showSpeechBubble,  setShowSpeechBubble]  = useState(false)
  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const conversationRef = useRef([])

  // Welcome message + badge rouge
  useEffect(() => {
    const t = setTimeout(() => {
      setMessages([WELCOME_MESSAGE])
      setHasUnread(true)
    }, 800)
    return () => clearTimeout(t)
  }, [])

  // Bulle d'accroche : apparaît 3s après le chargement si pas déjà fermée
  useEffect(() => {
    try {
      if (sessionStorage.getItem(BUBBLE_CLOSED_KEY)) return
    } catch (_) {}
    const t = setTimeout(() => setShowSpeechBubble(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Focus input à l'ouverture
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 220)
  }, [isOpen])

  // postMessage pour widget.js (redimensionne l'iframe)
  useEffect(() => {
    try {
      window.parent.postMessage({ type: 'NIKOA_WIDGET_STATE', isOpen }, '*')
    } catch (_) {}
  }, [isOpen])

  const dismissSpeechBubble = useCallback(() => {
    setShowSpeechBubble(false)
    try { sessionStorage.setItem(BUBBLE_CLOSED_KEY, '1') } catch (_) {}
  }, [])

  const toggleOpen = () => {
    setIsOpen(o => {
      if (!o) {
        setHasUnread(false)
        // Ferme la bulle définitivement quand le chat s'ouvre
        setShowSpeechBubble(false)
        try { sessionStorage.setItem(BUBBLE_CLOSED_KEY, '1') } catch (_) {}
      }
      return !o
    })
  }

  const sessionExhausted = userMsgCount >= MAX_USER_MESSAGES

  const handleCallback = useCallback(() => {
    setShowCallbackForm(true)
    setShowSuggestions(false)
  }, [])

  const handleCallbackSuccess = useCallback((telephone) => {
    setShowCallbackForm(false)
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `✅ Votre demande a bien été transmise à l'équipe NIKOA. Nous vous recontacterons rapidement.`,
      timestamp: new Date(),
    }])
  }, [])

  const getConversation = useCallback(() =>
    messages.map(m => ({ role: m.role, content: m.content }))
  , [messages])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping || sessionExhausted) return

    if (!hasUserSent) {
      setHasUserSent(true)
      setShowSuggestions(false)
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setUserMsgCount(c => c + 1)

    const newHistory = [...conversationRef.current, { role: 'user', content: trimmed }]
    conversationRef.current = newHistory

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const rawText = data.content[0].text
      const { text: assistantText, actions } = parseAssistantResponse(rawText)

      conversationRef.current = [...newHistory, { role: 'assistant', content: assistantText }]

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantText,
        actions,
        timestamp: new Date(),
      }])
    } catch (err) {
      console.error('API error:', err.message)
      const friendlyError =
        err.message.includes('Trop de messages') ||
        err.message.includes('trop de temps') ||
        err.message.includes('Session limitée')
          ? err.message
          : ERROR_TEXT

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: friendlyError,
        timestamp: new Date(),
      }])
      conversationRef.current = conversationRef.current.slice(0, -1)
      setUserMsgCount(c => c - 1)
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }, [isTyping, hasUserSent, sessionExhausted])

  const handleSubmit  = (e) => { e.preventDefault(); sendMessage(input) }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // Badge visible si unread OU si bulle d'accroche visible
  const showBadge = (hasUnread || showSpeechBubble) && !isOpen

  return (
    <>
      {/* ── Bulle d'accroche ──────────────────── */}
      {showSpeechBubble && !isOpen && (
        <SpeechBubble onClose={dismissSpeechBubble} onOpen={toggleOpen} />
      )}

      {/* ── Fenêtre de chat ────────────────────── */}
      <div
        className={`${styles.chatWindow} ${isOpen ? styles.chatWindowOpen : ''}`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="Chat démo - NIKOA"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerAvatar}>NK</div>
            <div className={styles.headerInfo}>
              <span className={styles.headerName}>NIKOA</span>
              <span className={styles.headerStatus}>
                <span className={styles.statusDot} />
                En ligne
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={toggleOpen} aria-label="Fermer le chat">
            <CloseXIcon size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className={styles.messagesArea}>
          {messages.map(msg => <Message key={msg.id} message={msg} onCallback={handleCallback} />)}
          {isTyping && <TypingIndicator />}
          {sessionExhausted && !isTyping && (
            <p className={styles.sessionLimit}>
              Démo terminée. Actualisez la page pour recommencer.
            </p>
          )}
          {showCallbackForm && (
            <CallbackForm
              onSuccess={handleCallbackSuccess}
              onClose={() => setShowCallbackForm(false)}
              getConversation={getConversation}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions */}
        {showSuggestions && messages.length > 0 && (
          <QuickSuggestions onSelect={s => sendMessage(s)} />
        )}

        {/* Zone de saisie */}
        <form className={styles.inputArea} onSubmit={handleSubmit}>
          <HamburgerMenu onCallback={handleCallback} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={sessionExhausted ? 'Démo terminée' : 'Posez votre question...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping || sessionExhausted}
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isTyping || !input.trim() || sessionExhausted}
            aria-label="Envoyer"
          >
            <SendIcon />
          </button>
        </form>
      </div>

      {/* ── Bulle flottante ────────────────────── */}
      <button
        className={`${styles.bubble} ${isOpen ? styles.bubbleHidden : ''}`}
        onClick={toggleOpen}
        aria-label={isOpen ? 'Fermer le chat' : 'Démo NIKOA'}
      >
        {isOpen ? <CloseXIcon size={22} color="white" /> : <ChatBubbleIcon />}
        {showBadge && <span className={styles.badge} aria-label="Nouveau message" />}
      </button>
    </>
  )
}
