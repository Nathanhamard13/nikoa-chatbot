import { useState, useEffect, useRef, useCallback } from 'react'
import Message from './components/Message'
import TypingIndicator from './components/TypingIndicator'
import CallbackForm from './components/CallbackForm'
import styles from './App.module.css'

const MAX_USER_MESSAGES = 10

const ERROR_TEXT = 'Je rencontre un problème technique. Contactez-nous sur nikoa.fr/contact.'

// ── Confirmations locales par secteur (affichées côté client uniquement) ──────
const SECTOR_CONFIRMATIONS = {
  1: `Vous avez choisi le secteur Comptable & Juridique. Je suis Sophie, assistante du Cabinet Véran & Associés. Posez-moi les questions que vos clients vous posent souvent, ou celles qui vous font perdre du temps — je suis là 24h/24 pour y répondre à leur place.`,
  2: `Vous avez choisi le secteur Médical & Paramédical. Je suis Emma, assistante du Cabinet Santé Loire. Posez-moi les questions que vos patients vous posent souvent, ou celles qui surchargent votre secrétariat — c'est exactement ce que je gère à leur place.`,
  3: `Vous avez choisi le secteur E-commerce. Je suis Alex, assistant de Maison Dore. Posez-moi les questions que vos clients posent avant d'acheter, après leur commande, ou quand ils veulent retourner un article — je réponds instantanément à leur place.`,
  4: `Vous avez choisi le secteur Artisan & PME locale. Je suis Marc, assistant de Dupont Plomberie. Posez-moi les questions que vos clients vous posent souvent par téléphone ou que vous n'avez pas le temps de traiter en journée — je les prends en charge à votre place.`,
}

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

// ── Icônes SVG (style Lucide) ──────────────────────────────────────────────────
function BriefcaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#FF0057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#FF0057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ShoppingBagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#FF0057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#FF0057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ── Données des cards de sélection ────────────────────────────────────────────
const SECTOR_CARDS = [
  { num: 1, label: 'Cabinet comptable ou juridique', Icon: BriefcaseIcon },
  { num: 2, label: 'Médical ou paramédical',          Icon: HeartIcon      },
  { num: 3, label: 'E-commerce ou boutique',          Icon: ShoppingBagIcon },
  { num: 4, label: 'Artisan ou PME locale',           Icon: WrenchIcon     },
]

// ── Écran de sélection de secteur ─────────────────────────────────────────────
function SectorScreen({ onSelect }) {
  return (
    <div className={styles.sectorScreen}>
      <div className={styles.sectorContent}>
        <h1 className={styles.sectorTitle}>Bienvenue dans la démo NIKOA</h1>
        <p className={styles.sectorSubtitle}>
          Pour quel domaine souhaitez-vous tester votre futur assistant IA ?
        </p>
        <div className={styles.sectorGrid}>
          {SECTOR_CARDS.map(({ num, label, Icon }) => (
            <button
              key={num}
              type="button"
              className={styles.sectorCard}
              onClick={() => onSelect(num)}
            >
              <span className={styles.sectorCardIcon}><Icon /></span>
              <span className={styles.sectorCardLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedSector,   setSelectedSector]   = useState(null)
  const [sectorLoading,    setSectorLoading]    = useState(false)
  const [messages,         setMessages]         = useState([])
  const [input,            setInput]            = useState('')
  const [isTyping,         setIsTyping]         = useState(false)
  const [userMsgCount,     setUserMsgCount]     = useState(0)
  const [showCallbackForm, setShowCallbackForm] = useState(false)
  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const conversationRef = useRef([])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sessionExhausted = userMsgCount >= MAX_USER_MESSAGES

  const handleCallback = useCallback(() => {
    setShowCallbackForm(true)
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

  // ── Sélection d'un secteur ──────────────────────────────────────────────────
  const handleSectorSelect = useCallback(async (num) => {
    // 1. Basculer immédiatement vers l'interface de chat
    setSelectedSector(num)
    setSectorLoading(true)

    // 2. Afficher la confirmation locale (côté client uniquement, pas envoyée à l'API)
    setMessages([{
      id: 'sector-confirm',
      role: 'assistant',
      content: SECTOR_CONFIRMATIONS[num],
      timestamp: new Date(),
    }])

    // 3. Envoyer le numéro silencieusement à l'API pour activer le bon persona
    const silentHistory = [{ role: 'user', content: String(num) }]
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: silentHistory }),
      })
      if (response.ok) {
        const data = await response.json()
        const rawText = data.content[0].text
        const { text: assistantText } = parseAssistantResponse(rawText)
        // Stocker la vraie réponse API dans l'historique pour les échanges suivants
        conversationRef.current = [...silentHistory, { role: 'assistant', content: assistantText }]
      } else {
        // Fallback : utiliser le message local comme contexte
        conversationRef.current = [...silentHistory, { role: 'assistant', content: SECTOR_CONFIRMATIONS[num] }]
      }
    } catch {
      conversationRef.current = [...silentHistory, { role: 'assistant', content: SECTOR_CONFIRMATIONS[num] }]
    } finally {
      setSectorLoading(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [])

  // ── Envoi d'un message utilisateur ─────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping || sessionExhausted || sectorLoading) return

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
  }, [isTyping, sessionExhausted, sectorLoading])

  const handleSubmit  = (e) => { e.preventDefault(); sendMessage(input) }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  return (
    <div className={styles.app}>
      {selectedSector === null ? (
        // ── Écran de sélection ──────────────────────────────────────────────
        <SectorScreen onSelect={handleSectorSelect} />
      ) : (
        // ── Interface de chat ───────────────────────────────────────────────
        <div className={styles.column}>
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

          <form className={styles.inputArea} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder={
                sectorLoading    ? 'Chargement…' :
                sessionExhausted ? 'Démo terminée' :
                                   'Posez votre question…'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping || sessionExhausted || sectorLoading}
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isTyping || !input.trim() || sessionExhausted || sectorLoading}
              aria-label="Envoyer"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
