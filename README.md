# Relya — Assistant Virtuel IA

Chatbot IA professionnel pour le cabinet Relya, propulsé par Claude (Anthropic).

---

## Déploiement sur Vercel en 5 minutes

### Étape 1 — Clé API Anthropic
1. [console.anthropic.com](https://console.anthropic.com) → **API Keys** → **Create Key**
2. Copiez la clé `sk-ant-...`

### Étape 2 — Déployer sur Vercel

**Via GitHub (recommandé)**
1. Créez un repo GitHub et pushez ce projet
2. [vercel.com](https://vercel.com) → **New Project** → importez le repo
3. **Environment Variables** → ajoutez :
   - `VITE_ANTHROPIC_API_KEY` = `sk-ant-...`
4. **Deploy** → terminé

**Via Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --env VITE_ANTHROPIC_API_KEY=sk-ant-...
```

---

## Lancer en local

```bash
cd relya-chatbot
npm install
cp .env.example .env
# Éditez .env : VITE_ANTHROPIC_API_KEY=sk-ant-votre_clé
npm run dev
```

Ouvrez [http://localhost:5173](http://localhost:5173)

---

## Structure

```
relya-chatbot/
├── src/
│   ├── components/
│   │   ├── Header.jsx / .module.css
│   │   ├── Hero.jsx / .module.css
│   │   ├── Message.jsx / .module.css
│   │   ├── TypingIndicator.jsx / .module.css
│   │   ├── QuickSuggestions.jsx / .module.css
│   │   └── Footer.jsx / .module.css
│   ├── App.jsx / App.module.css
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore        ← node_modules/ et dist/ exclus
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## Stack
- **React 18** + **Vite 5** + **CSS Modules**
- **Anthropic API** — `claude-sonnet-4-5-20250929`
- **Vercel** pour l'hébergement
