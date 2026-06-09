import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/globals.css'

// Leaflet loads tiles asynchronously; if a tile arrives after React has
// already torn down the DOM, Leaflet's insertBefore call throws a
// NotFoundError. We swallow it here so it never reaches the React error
// boundary or React Router's error page.
window.addEventListener('error', (e) => {
  if (
    e.error instanceof DOMException ||
    e.message?.toLowerCase().includes('insertbefore') ||
    e.message?.toLowerCase().includes('is not a child')
  ) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
