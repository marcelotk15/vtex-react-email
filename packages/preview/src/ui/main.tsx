import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/public-sans/latin-400.css'
import '@fontsource/public-sans/latin-500.css'
import '@fontsource/public-sans/latin-600.css'
import { createRoot } from 'react-dom/client'

import { App } from './app'
import './styles/app.css'

const root = document.querySelector('#root')
if (root) createRoot(root).render(<App />)
