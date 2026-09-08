import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  // Create shadow root for CSS isolation
  const shadow = hostEl.attachShadow({ mode: 'open' })

  // Create a container inside the shadow root
  const container = document.createElement('div')
  container.style.cssText = 'height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
  shadow.appendChild(container)

  // Inject base reset styles into shadow root
  const style = document.createElement('style')
  style.textContent = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :host {
      display: block;
      height: 100vh;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #333;
    }
    button { font-family: inherit; }
    input, textarea, select { font-family: inherit; }
    a { text-decoration: none; }
  `
  shadow.appendChild(style)

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

mountWidget()