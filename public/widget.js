;(function () {
  'use strict'

  var WIDGET_URL = 'https://relya-chatbot.vercel.app'
  var BUBBLE_SIZE = 88   // px — taille iframe bulle fermée
  var OPEN_W = 420       // px — largeur iframe chat ouvert
  var OPEN_H = 720       // px — hauteur iframe chat ouvert
  var MARGIN = 16        // px — marge bord écran

  // Évite les doublons si le script est chargé plusieurs fois
  if (window.__RelayaChat) return
  window.__RelayaChat = true

  /* ── Crée l'iframe ───────────────────────── */
  var iframe = document.createElement('iframe')
  iframe.src = WIDGET_URL
  iframe.title = 'Chat Sophie — Cabinet Relya'
  iframe.allow = 'microphone'
  iframe.setAttribute('allowtransparency', 'true')

  Object.assign(iframe.style, {
    position:   'fixed',
    bottom:     MARGIN + 'px',
    right:      MARGIN + 'px',
    width:      BUBBLE_SIZE + 'px',
    height:     BUBBLE_SIZE + 'px',
    border:     'none',
    zIndex:     '2147483647',
    background: 'transparent',
    overflow:   'hidden',
    transition: 'width 0.22s ease, height 0.22s ease',
    borderRadius: '50%',    // arrondi quand bulle
    display:    'block',
  })

  document.body.appendChild(iframe)

  /* ── Écoute les messages de l'iframe ─────── */
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'RELYA_WIDGET_STATE') return

    var isMobile = window.innerWidth <= 480

    if (e.data.isOpen) {
      // Chat ouvert → grande iframe
      if (isMobile) {
        Object.assign(iframe.style, {
          width:        '100%',
          height:       '100%',
          bottom:       '0',
          right:        '0',
          borderRadius: '0',
        })
      } else {
        Object.assign(iframe.style, {
          width:        OPEN_W + 'px',
          height:       OPEN_H + 'px',
          bottom:       MARGIN + 'px',
          right:        MARGIN + 'px',
          borderRadius: '16px',
        })
      }
    } else {
      // Chat fermé → petite bulle
      Object.assign(iframe.style, {
        width:        BUBBLE_SIZE + 'px',
        height:       BUBBLE_SIZE + 'px',
        bottom:       MARGIN + 'px',
        right:        MARGIN + 'px',
        borderRadius: '50%',
      })
    }
  })

  /* ── API publique ────────────────────────── */
  window.RelayaChat = {
    init: function () { /* déjà initialisé à l'exécution du script */ },
    open: function () {
      iframe.contentWindow.postMessage({ type: 'RELYA_OPEN' }, '*')
    },
    close: function () {
      iframe.contentWindow.postMessage({ type: 'RELYA_CLOSE' }, '*')
    },
  }
})()
