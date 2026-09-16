import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  const shadow = hostEl.attachShadow({ mode: 'open' })
  const container = document.createElement('div')
  container.style.cssText = 'width: 100%; min-height: 100vh;'
  shadow.appendChild(container)

  const style = document.createElement('style')
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    :host { display: block; width: 100%; min-height: 100vh; font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, textarea, select { font-family: inherit; }
    a { text-decoration: none; }
  `
  shadow.appendChild(style)

  ReactDOM.createRoot(container).render(
    <React.StrictMode><App /></React.StrictMode>
  )
}

mountWidget()
