import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  // Dev-only hook used to batch-analyze games from the console.
  void Promise.all([import('./db/db'), import('./analysis/analyzeGame')]).then(
    ([{ db }, { analyzeGame }]) => {
      Object.assign(window, { __ct: { db, analyzeGame } })
    },
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
