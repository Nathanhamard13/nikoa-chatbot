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

/* ── SendIcon ─────────────────────────────────── */
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

/* ── App ──────────────────────────────────────── */
export default function App() {
  const [messages,         setMessages]         = useState([])
  const [input,            setInput]            = useState('')
  const [isTyping,         setIsTyping]         = useState(false)
  const [showSuggestions,  setShowSuggestions]  = useState(true)
  const [hasUserSent,      setHasUserSent]      = useState(false)
  const [userMsgCount,     setUserMsgCount]     = useState(0)
  const [showCallbackForm, setShowCallbackForm] = useState(false)
  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const conversationRef = useRef([])

  // Welcome message
  useEffect(() => {
    const t = setTimeout(() => setMessages([WELCOME_MESSAGE]), 600)
    return () => clearTimeout(t)
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 700)
  }, [])

  const sessionExhausted = userMsgCount >= MAX_USER_MESSAGES

  const handleCallback = useCallback(() => {
    setShowCallbackForm(true)
    setShowSuggestions(false)
  }, [])

  const handleCallbackSuccess = useCallback(() => {
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

  return (
    <div className={styles.app}>
      {/* ── Header ────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <div className={styles.headerAvatar}>NK</div>
            <div className={styles.headerInfo}>
              <span className={styles.headerName}>
                NIKO<span className={styles.headerAccent}>A</span>
              </span>
              <span className={styles.headerStatus}>
                <span className={styles.statusDot} />
                En ligne
              </span>
            </div>
          </div>
          <HamburgerMenu onCallback={handleCallback} />
        </div>
      </header>

      {/* ── Center column ─────────────────────── */}
      <div className={styles.column}>
        {/* Messages */}
        <div className={styles.messagesArea}>
          {messages.map(msg => (
            <Message key={msg.id} message={msg} onCallback={handleCallback} />
          ))}
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

        {/* Input */}
        <form className={styles.inputArea} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={sessionExhausted ? 'Démo terminée' : 'Posez votre question…'}
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
    </div>
  )
}
