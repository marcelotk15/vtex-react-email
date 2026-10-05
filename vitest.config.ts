import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Vitest accepts oxc; the Vite 7 config types do not list it.
  // @ts-expect-error oxc is a vitest option
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: {
      '@vtex-email/cli/project': path.join(root, 'packages/cli/src/project.ts'),
      '@vtex-email/cli': path.join(root, 'packages/cli/src/index.ts'),
      '@vtex-email/core': path.join(root, 'packages/core/src/index.ts'),
      '@vtex-email/react': path.join(root, 'packages/react/src/index.ts'),
      '@vtex-email/vtex': path.join(root, 'packages/vtex/src/index.ts'),
      '@vtex-email/preview': path.join(root, 'packages/preview/src/index.ts'),
      '@vtex-email/test-harness': path.join(root, 'tooling/test-harness/index.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/*.test.{ts,tsx}', 'tooling/**/*.test.{ts,tsx}'],
  },
})
