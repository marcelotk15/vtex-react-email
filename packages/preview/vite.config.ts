import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { browserImportViolation } from './src/assets/browser-boundary'
import { themeBootScript } from './src/ui/theme/theme'

const root = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.join(root, 'src/ui')

export default defineConfig({
  root: uiRoot,
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'preview-ui-boundary',
      resolveId(id) {
        const violation = browserImportViolation(id)
        if (violation) throw new Error(violation)
        return null
      },
    },
    {
      name: 'preview-theme-boot',
      transformIndexHtml(html) {
        if (html.includes('data-theme')) return html
        return html.replace('<head>', `<head>\n    <script>${themeBootScript()}</script>`)
      },
    },
  ],
  resolve: {
    alias: {
      '@': uiRoot,
    },
  },
  build: {
    outDir: path.join(root, 'dist/client'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: path.join(uiRoot, 'index.html'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
