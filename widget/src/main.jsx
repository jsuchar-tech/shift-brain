import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  // Simple wrapper — no shadow DOM
  // CSS isolation handled by scoped classname prefix in components
  hostEl.style.cssText = `
    all: initial;
    display: block;
    height: 100vh;
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #333;
    box-sizing: border-box;
  `

  ReactDOM.createRoot(hostEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

mountWidget()