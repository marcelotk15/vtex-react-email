import { pixelBasedPreset } from '@react-email/components'
import { defineConfig } from '@vtex-email/cli'

export default defineConfig({
  emails: ['src/emails/**/*.email.tsx'],
  outDir: 'dist',
  fixturesDir: 'src/fixtures',
  schemasDir: 'src/schemas',
  i18n: {
    locales: ['pt-BR', 'en-US'],
    defaultLocale: 'pt-BR',
    catalogs: 'src/locales/{locale}.json',
    missingKey: 'error',
    localePath: 'locale',
  },
  tailwind: {
    presets: [pixelBasedPreset],
    theme: {
      extend: {
        colors: {
          brand: '#E1251B',
        },
        screens: {
          ns: '30em',
        },
      },
    },
  },
  validation: {
    unknownPath: 'error',
    unverifiedCapability: 'warning',
    warningsAsErrors: false,
  },
  compatibility: {
    policy: 'conservative',
    maxSourceBytes: 250_000,
    warnRenderedBytes: 90_000,
  },
  preview: { host: '127.0.0.1', port: 3000 },
})
