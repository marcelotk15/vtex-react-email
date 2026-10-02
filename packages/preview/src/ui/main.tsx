import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import { createRoot } from 'react-dom/client'

import { App } from './app'
import './styles/app.css'

const root = document.querySelector('#root')
if (root) createRoot(root).render(<App />)
