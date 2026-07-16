import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cross-origin isolation unlocks SharedArrayBuffer, which the opt-in
// multi-threaded Stockfish build needs. COEP is `credentialless` (not
// `require-corp`) so the cross-origin Google Fonts @import in index.css keeps
// loading. Applied to dev + preview here; production is set in vercel.json.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
})
