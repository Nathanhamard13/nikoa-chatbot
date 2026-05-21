import { SYSTEM_PROMPTS, MODELS, MAX_MESSAGES, MAX_MSG_LENGTH } from './config.js'

// ─── Rate limiter en mémoire (20 req/IP/heure) ───────────────────────────────
const rateLimitStore = new Map()

function isRateLimited(ip, max = 20) {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  return false
}

// Nettoyage périodique du store (évite les fuites mémoire)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitStore) {
    if (now > val.resetAt) rateLimitStore.delete(key)
  }
}, 15 * 60 * 1000)

// ─── Sanitisation anti-injection ─────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instruction/i,
  /system\s*prompt/i,
  /\bact\s+as\b.*\b(gpt|claude|llm|ai|assistant)\b/i,
  /\byou\s+are\s+now\b/i,
  /\bforget\s+(everything|all|your)\b/i,
  /\bdisregard\s+(your|all|previous)\b/i,
  /\bpretend\s+(you\s+are|to\s+be)\b/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
]

function sanitizeContent(text) {
  // Supprime les null bytes et caractères de contrôle (sauf \n \t)
  let clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  // Limite les répétitions excessives d'un même caractère (ex: aaaaa...)
  clean = clean.replace(/(.)\1{49,}/g, '$1'.repeat(20) + '…')
  return clean
}

function detectInjection(text) {
  return INJECTION_PATTERNS.some(p => p.test(text))
}

// ─── Détection de spam (messages répétitifs) ─────────────────────────────────
function isSpam(messages) {
  const userMsgs = messages.filter(m => m.role === 'user')
  if (userMsgs.length < 3) return false
  const last = userMsgs[userMsgs.length - 1].content.trim()
  const prev = userMsgs[userMsgs.length - 2].content.trim()
  const prev2 = userMsgs[userMsgs.length - 3].content.trim()
  // 3 messages utilisateur identiques consécutifs = spam
  return last === prev && prev === prev2
}

// ─── Validation des messages ──────────────────────────────────────────────────
function validateMessages(messages) {
  if (!Array.isArray(messages))            return 'Le champ messages doit être un tableau.'
  if (messages.length === 0)               return 'Le tableau messages est vide.'
  if (messages.length > MAX_MESSAGES * 2)  return `Session limitée à ${MAX_MESSAGES} échanges.`
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null)   return 'Message invalide.'
    if (!['user', 'assistant'].includes(msg.role)) return `Rôle "${msg.role}" non autorisé.`
    if (typeof msg.content !== 'string')           return 'Le contenu doit être une chaîne.'
    if (msg.content.trim().length === 0)           return 'Message vide non autorisé.'
    if (msg.content.length > MAX_MSG_LENGTH)
      return `Message trop long (max ${MAX_MSG_LENGTH} caractères).`
  }
  return null
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
function isAllowedOrigin(origin) {
  if (!origin) return false
  if (origin.startsWith('http://localhost:')) return true
  if (origin === 'https://nikoa-chatbot.vercel.app') return true
  if (/^https:\/\/nikoa-chatbot[^.]*\.vercel\.app$/.test(origin)) return true
  return false
}

function applyCORS(req, res) {
  const origin = req.headers.origin
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

// ─── Fallback automatique avec prompt par modèle ──────────────────────────────
async function callWithFallback(messages, apiKey, signal) {
  for (const model of MODELS) {
    const systemPrompt = SYSTEM_PROMPTS[model]
    let response, data

    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
        signal,
      })
      data = await response.json()
    } catch (err) {
      if (err.name === 'AbortError') throw err
      console.error(`[api/chat] Modèle ${model} — réseau: ${err.message}`)
      continue
    }

    if (response.ok) {
      if (model !== MODELS[0]) console.log(`[api/chat] Fallback actif : ${model}`)
      return { ok: true, data, status: response.status }
    }

    if (response.status === 404 || response.status === 400 || response.status === 529) {
      console.warn(`[api/chat] Modèle ${model} indisponible (${response.status}), tentative suivante…`)
      continue
    }

    return { ok: false, data, status: response.status }
  }

  console.error('[api/chat] Tous les modèles ont échoué')
  return {
    ok: false,
    data: { error: { message: 'Service IA temporairement indisponible.' } },
    status: 503,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  applyCORS(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée.' })

  // Content-Type check
  const ct = req.headers['content-type'] || ''
  if (!ct.includes('application/json'))
    return res.status(415).json({ error: 'Content-Type application/json requis.' })

  // Rate limiting
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip, 20))
    return res.status(429).json({ error: 'Trop de messages envoyés. Veuillez patienter une heure.' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[api/chat] ANTHROPIC_API_KEY absente')
    return res.status(500).json({ error: 'Erreur de configuration serveur.' })
  }

  const { messages } = req.body || {}
  const validationError = validateMessages(messages)
  if (validationError) return res.status(400).json({ error: validationError })

  // Détection spam
  if (isSpam(messages))
    return res.status(429).json({ error: 'Trop de messages identiques. Variez votre question.' })

  // Sanitisation + détection injection de prompt
  const sanitized = messages.map(msg => ({
    ...msg,
    content: sanitizeContent(msg.content),
  }))

  // Vérification injection uniquement sur les messages utilisateur
  for (const msg of sanitized) {
    if (msg.role === 'user' && detectInjection(msg.content)) {
      return res.status(400).json({ error: 'Message non valide. Posez votre question différemment.' })
    }
  }

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 30_000)

  try {
    const { ok, data, status } = await callWithFallback(sanitized, apiKey, controller.signal)
    clearTimeout(timeoutId)

    if (ok) return res.status(200).json(data)

    if (status === 401) {
      console.error('[api/chat] Clé API invalide')
      return res.status(500).json({ error: 'Erreur de configuration serveur.' })
    }
    if (status === 429)
      return res.status(429).json({ error: 'Service temporairement surchargé. Réessayez dans quelques instants.' })
    if (status === 503)
      return res.status(503).json({ error: 'Service IA temporairement indisponible. Réessayez dans quelques minutes.' })

    console.error('[api/chat] Erreur Anthropic', status)
    return res.status(500).json({ error: 'Erreur du service IA. Réessayez.' })

  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.error('[api/chat] Timeout 30s')
      return res.status(504).json({ error: 'La requête a pris trop de temps. Réessayez.' })
    }
    console.error('[api/chat] Erreur inattendue')
    return res.status(500).json({ error: 'Erreur interne. Réessayez.' })
  }
}
