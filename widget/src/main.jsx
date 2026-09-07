import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  // Clerk needs to render in the normal DOM to get its styles
  // We create two layers:
  // 1. A normal DOM container for Clerk auth UI
  // 2. A shadow DOM container for the chat UI (CSS isolated)

  const shadow = hostEl.attachShadow({ mode: 'open' })

  // Base reset inside shadow
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

  const shadowContainer = document.createElement('div')
  shadowContainer.style.cssText = 'height: 100%; width: 100%;'
  shadow.appendChild(shadowContainer)

  // Also create a normal DOM portal container for Clerk
  // This sits outside the shadow DOM so Clerk's injected styles work
  const clerkPortal = document.createElement('div')
  clerkPortal.id = 'shift-brain-clerk-portal'
  clerkPortal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f7f9fc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `
  document.body.appendChild(clerkPortal)

  ReactDOM.createRoot(shadowContainer).render(
    <React.StrictMode>
      <App clerkPortalId="shift-brain-clerk-portal" />
    </React.StrictMode>
  )
}

mountWidget()