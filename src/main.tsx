import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-ext-600.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-ext-700.css'
import App from './App'
import { LandscapeNotice } from './components/LandscapeNotice'
import './styles.css'
import './classroom.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="landscape-app"><App /></div>
    <LandscapeNotice />
  </StrictMode>,
)
