import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGame } from './store'

// dev-only hook so E2E scripts can drive the game
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = useGame
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
