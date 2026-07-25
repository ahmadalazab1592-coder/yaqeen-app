import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// 1. أضف سطر الاستدعاء هذا هنا
import { Analytics } from '@vercel/analytics/react' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* 2. أضف هذا السطر هنا أسفل التطبيق مباشرة */}
    <Analytics />
  </StrictMode>,
)
