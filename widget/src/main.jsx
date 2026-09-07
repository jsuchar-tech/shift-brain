import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  const shadow = hostEl.attachShadow({ mode: 'open' })

  // Inject Clerk styles into shadow root by copying from document head
  // This runs after Clerk loads its styles
  function syncClerkStyles() {
    const clerkStyles = document.querySelectorAll('style[data-clerk], link[data-clerk]')
    clerkStyles.forEach(el => {
      const clone = el.cloneNode(true)
      shadow.appendChild(clone)
    })
  }

  // Base reset styles
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

  // Clerk portal in normal DOM
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