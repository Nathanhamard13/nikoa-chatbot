import { MODELS } from './config.js'

// ─── Rate limiter en mémoire (3 rappels/IP/heure) ────────────────────────────
const callbackRateStore = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = callbackRateStore.get(ip)
  if (!entry || now > entry.resetAt) {
    callbackRateStore.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 3) return true
  entry.count++
  return false
}

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of callbackRateStore) {
    if (now > val.resetAt) callbackRateStore.delete(key)
  }
}, 15 * 60 * 1000)

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

// ─── Sanitisation ─────────────────────────────────────────────────────────────
function sanitizeText(text, maxLen = 500) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/(.)\1{49,}/g, '$1'.repeat(20) + '…')
    .slice(0, maxLen)
    .trim()
}

// Escaping HTML basique pour l'email (prévient les injections HTML)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Résumé IA via Claude (avec timeout 20s) ──────────────────────────────────
async function generateSummary(conversation, apiKey) {
  const conversationText = conversation
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Visiteur' : 'Assistant'} : ${m.content}`)
    .join('\n\n')

  const prompt = `Tu es un assistant commercial expert. Analyse cette conversation entre le chatbot démo NIKOA et un prospect, et génère un briefing concis pour l'expert-comptable qui va rappeler ce prospect.

Format de réponse OBLIGATOIRE :

SITUATION DU PROSPECT
[2-3 phrases résumant la situation professionnelle, le besoin principal, le contexte]

PERSONNALITÉ DÉTECTÉE
[1-2 phrases sur le style de communication, le niveau d'urgence, le profil décisionnel]

POINTS DE FRICTION OU MOTIVATIONS
[Ce qui l'a amené à contacter, ses éventuelles frustrations, ce qui l'intéresse vraiment]

APPROCHE RECOMMANDÉE
[Comment l'aborder au téléphone : ton, angle, ce qu'il faut dire en premier]

SUJETS À ABORDER EN PRIORITÉ
[Liste courte des 2-3 points clés à couvrir dans l'appel]

Conversation :
${conversationText}`

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 20_000)

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      })
      if (res.ok) {
        clearTimeout(timeoutId)
        const data = await res.json()
        return data.content[0].text
      }
      if (res.status === 404 || res.status === 529 || res.status === 400) continue
    } catch (err) {
      if (err.name === 'AbortError') break
      continue
    }
  }

  clearTimeout(timeoutId)
  return 'Résumé IA non disponible — consultez l\'historique complet ci-dessous.'
}

// ─── Envoi email via Resend REST API ──────────────────────────────────────────
async function sendEmail({ prenom, telephone, moment, summary, conversationText, resendKey, cabinetEmail, fromEmail }) {
  const now = new Date().toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const safePrenom    = escapeHtml(prenom)
  const safeTelephone = escapeHtml(telephone)
  const safeMoment    = moment ? escapeHtml(moment) : ''

  const summaryHtml = escapeHtml(summary)
    .replace(/\n\n/g, '</p><p style="margin:12px 0 4px 0;">')
    .replace(/^([A-ZÀÂÉÈÙÎ ]{4,})$/gm, '<strong style="color:#4f46e5;">$1</strong>')
    .replace(/\n/g, '<br>')

  const historyHtml = conversationText
    .split('\n\n')
    .map(line => {
      const isProspect = line.startsWith('Prospect')
      const safeText = escapeHtml(line.replace(/^(Prospect|Claire) : /, '')).replace(/\n/g, '<br>')
      return `<p style="margin:6px 0; padding:8px 12px; border-radius:6px; background:${isProspect ? '#f0f0f0' : '#e8f0f8'}; font-size:13px;">
        <strong>${isProspect ? '👤 Prospect' : '🤖 Claire'} :</strong><br>
        ${safeText}
      </p>`
    }).join('')

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border-radius: 10px; overflow: hidden; border: 1px solid #e0e0e0;">

  <div style="background: linear-gradient(135deg, #4f46e5, #4338ca); padding: 24px 28px;">
    <h2 style="color: white; margin: 0; font-size: 20px;">Nouvelle demande de rappel</h2>
    <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 14px;">Via le chatbot démo NIKOA · ${now}</p>
  </div>

  <div style="background: #f7f8fa; padding: 20px 28px; border-bottom: 1px solid #e8e8e8;">
    <h3 style="color: #1a1a1a; margin: 0 0 14px; font-size: 16px;">📋 Coordonnées du prospect</h3>
    <table style="font-size: 14px; line-height: 1.8; width: 100%;">
      <tr><td style="color:#666; width:150px;">Prénom</td><td><strong>${safePrenom}</strong></td></tr>
      <tr><td style="color:#666;">Téléphone</td><td><a href="tel:${safeTelephone}" style="color:#4f46e5; font-weight:bold; font-size:16px;">${safeTelephone}</a></td></tr>
      <tr><td style="color:#666;">Meilleur moment</td><td>${safeMoment || '<em style="color:#999">Non précisé</em>'}</td></tr>
    </table>
  </div>

  <div style="background: white; padding: 20px 28px; border-bottom: 1px solid #e8e8e8;">
    <h3 style="color: #4f46e5; margin: 0 0 14px; font-size: 16px;">🧠 Briefing IA — Préparez votre appel</h3>
    <div style="background: #f5f3ff; padding: 18px 20px; border-radius: 8px; border-left: 4px solid #4f46e5; font-size: 14px; line-height: 1.7; color: #2c2c2c;">
      <p style="margin:0;">${summaryHtml}</p>
    </div>
  </div>

  <div style="background: white; padding: 20px 28px;">
    <h3 style="color: #1a1a1a; margin: 0 0 14px; font-size: 16px;">💬 Historique complet de la conversation</h3>
    ${historyHtml}
  </div>

  <div style="background: #f7f8fa; padding: 14px 28px; border-top: 1px solid #e8e8e8; text-align: center;">
    <p style="font-size: 12px; color: #999; margin: 0;">Email généré automatiquement par le chatbot démo · NIKOA — Agence Web & IA · nikoa.fr</p>
  </div>

</div>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromEmail || 'Claire - Arcomex <onboarding@resend.dev>',
      to:      [cabinetEmail],
      subject: `📞 Rappel demandé — ${safePrenom} (${safeTelephone})`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({}))
    throw new Error(`Resend ${emailRes.status}: ${err?.message || 'Erreur envoi email'}`)
  }
  return await emailRes.json()
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
  if (isRateLimited(ip))
    return res.status(429).json({ error: 'Trop de demandes de rappel. Merci de nous appeler directement au 02 99 75 89 00.' })

  const { prenom, telephone, moment, conversation, website } = req.body || {}

  // Honeypot anti-bot : si le champ "website" (caché) est rempli, on rejette silencieusement
  if (website) {
    return res.status(200).json({ success: true })
  }

  // Validation et sanitisation
  const prenomClean  = sanitizeText(prenom, 100)
  const momentClean  = sanitizeText(moment, 500)

  if (!prenomClean)     return res.status(400).json({ error: 'Le prénom est requis.' })
  if (!telephone?.trim()) return res.status(400).json({ error: 'Le numéro de téléphone est requis.' })

  const telClean = telephone.trim().replace(/[\s\-\.()+]/g, '')
  if (!/^(0[1-9]\d{8}|33[1-9]\d{8})$/.test(telClean))
    return res.status(400).json({ error: 'Numéro de téléphone invalide (format français attendu).' })

  // Validation de la conversation (max 30 échanges, 2000 chars chacun)
  const safeConversation = Array.isArray(conversation)
    ? conversation
        .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .slice(0, 30)
        .map(m => ({ role: m.role, content: sanitizeText(m.content, 2000) }))
    : []

  const anthropicKey  = process.env.ANTHROPIC_API_KEY
  const resendKey     = process.env.RESEND_API_KEY
  const cabinetEmail  = process.env.CABINET_EMAIL  || 'contact@nikoa.fr'
  const fromEmail     = process.env.RESEND_FROM_EMAIL

  if (!resendKey) {
    console.error('[api/callback] RESEND_API_KEY absente')
    return res.status(500).json({ error: 'Configuration email manquante.' })
  }

  const conversationText = safeConversation.length
    ? safeConversation
        .map(m => `${m.role === 'user' ? 'Visiteur' : 'Assistant'} : ${m.content}`)
        .join('\n\n')
    : 'Aucune conversation enregistrée.'

  // Résumé IA
  let summary = 'Résumé non généré (clé Anthropic absente ou conversation vide).'
  if (anthropicKey && safeConversation.length > 1) {
    try {
      summary = await generateSummary(safeConversation, anthropicKey)
    } catch (e) {
      console.warn('[api/callback] Résumé IA échoué')
    }
  }

  // Envoi email
  try {
    await sendEmail({
      prenom:           prenomClean,
      telephone:        telClean,
      moment:           momentClean,
      summary,
      conversationText,
      resendKey,
      cabinetEmail,
      fromEmail,
    })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[api/callback] Erreur email')
    return res.status(500).json({ error: 'Impossible d\'envoyer l\'email. Réessayez ou appelez le 02 99 75 89 00.' })
  }
}
