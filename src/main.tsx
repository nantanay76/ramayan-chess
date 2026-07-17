import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGame } from './store'

// dev-only hook so E2E scripts can drive the game
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = useGame
}

// offline shell + reliable Chrome install prompt (prod only — a SW caching
// dev-server responses would poison local iteration)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
