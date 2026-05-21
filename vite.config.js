import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { SYSTEM_PROMPT, MODEL, MAX_TOKENS } from './api/config.js'

function readDotEnv(dir = process.cwd()) {
  const envPath = resolve(dir, '.env')
  if (!existsSync(envPath)) return {}
  const result = {}
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)$/)
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return result
}

function devApiPlugin(apiKey) {
  return {
    name: 'dev-api-chat',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Method not allowed' }))
        }
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante dans .env — voir .env.example' }))
        }
        let raw = ''
        req.on('data', chunk => { raw += chunk })
        req.on('end', async () => {
          try {
            const { messages } = JSON.parse(raw)
            const controller = new AbortController()
            const timeoutId  = setTimeout(() => controller.abort(), 30_000)
            const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type':      'application/json',
                'x-api-key':         apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages }),
              signal: controller.signal,
            })
            clearTimeout(timeoutId)
            const data = await anthropicRes.json()
            res.statusCode = anthropicRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          } catch (err) {
            console.error('[dev api/chat]', err.message)
            res.statusCode = err.name === 'AbortError' ? 504 : 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

const localEnv = readDotEnv()

export default defineConfig({
  plugins: [react(), devApiPlugin(localEnv.ANTHROPIC_API_KEY)],
})
