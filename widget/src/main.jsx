import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function mountWidget() {
  const hostEl = document.getElementById('shift-brain-root')
  if (!hostEl) return

  const shadow = hostEl.attachShadow({ mode: 'open' })
  const container = document.createElement('div')
  container.style.cssText = 'width: 100%; height: 100%; min-height: 0; overflow: hidden;'
  shadow.appendChild(container)

  const style = document.createElement('style')
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    :host { display: block; width: 100%; height: 100%; min-height: 0; overflow: hidden; font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, textarea, select { font-family: inherit; }
    a { text-decoration: none; }
  `
  shadow.appendChild(style)

  const findSquarespaceHeader = () => [
    '.header-announcement-bar-wrapper',
    'header.Header',
    '#header',
    'header'
  ].map(selector => document.querySelector(selector)).find(Boolean)

  const updateWidgetHeight = () => {
    const configured = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--brain-header-height')
    )
    const headerHeight = findSquarespaceHeader()?.getBoundingClientRect().height || 0
    const embedTop = Math.max(0, hostEl.getBoundingClientRect().top + window.scrollY)
    const reservedHeight = Number.isFinite(configured) && configured >= 0
      ? configured
      : Math.max(headerHeight, embedTop)

    hostEl.style.setProperty('--brain-embed-height', `calc(100dvh - ${Math.ceil(reservedHeight)}px)`)
    hostEl.style.height = 'var(--brain-embed-height)'
    hostEl.style.maxHeight = 'var(--brain-embed-height)'
  }

  updateWidgetHeight()
  requestAnimationFrame(updateWidgetHeight)
  window.addEventListener('resize', updateWidgetHeight)
  window.visualViewport?.addEventListener('resize', updateWidgetHeight)

  const squarespaceHeader = findSquarespaceHeader()
  if (squarespaceHeader && 'ResizeObserver' in window) {
    new ResizeObserver(updateWidgetHeight).observe(squarespaceHeader)
  }

  ReactDOM.createRoot(container).render(
    <React.StrictMode><App /></React.StrictMode>
  )
}

mountWidget()
