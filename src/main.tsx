import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { readAudienceMode } from '@/services/audienceMode'

// 配色はモードで変わる(index.css)。最初の描画より前に貼って、色のちらつきを防ぐ。
// 以後の切り替えは App の AudienceTheme が追従する。
document.documentElement.dataset.audience = readAudienceMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
