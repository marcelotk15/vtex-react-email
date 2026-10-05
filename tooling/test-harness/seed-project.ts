import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { linkWorkspaceModules } from './link-modules'
import { createTempDir, createTempDirWithSpaces } from './temp-dir'

export const SEED_WELCOME = 'welcome'
export const SEED_OPS = 'ops-notice'
export const SEED_FREEZE_MARKER = 'FREEZE-MARKER'
export const SEED_GREETING_EN = 'Hi'
export const SEED_GREETING_PT = 'Olá'

const files: Record<string, string> = {
  'package.json': `${JSON.stringify(
    {
      name: 'vtex-email-test-seed',
      private: true,
      type: 'module',
    },
    null,
    2,
  )}\n`,
  'vtex-email.config.ts': `import { pixelBasedPreset } from '@react-email/components'
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
  tailwind: { presets: [pixelBasedPreset] },
  validation: {
    unknownPath: 'error',
    unverifiedCapability: 'warning',
    warningsAsErrors: false,
  },
  preview: { host: '127.0.0.1', port: 3000 },
})
`,
  'src/locales/en-US.json': `${JSON.stringify(
    {
      'welcome.hello': 'Hi',
      'ops.body': 'Notice',
    },
    null,
    2,
  )}\n`,
  'src/locales/pt-BR.json': `${JSON.stringify(
    {
      'welcome.hello': 'Olá',
      'ops.body': 'Aviso',
    },
    null,
    2,
  )}\n`,
  'src/schemas/welcome.ts': `import { z } from 'zod'

export default z.object({
  client: z.object({
    locale: z.string().optional().nullable(),
    name: z.string(),
  }),
})
`,
  'src/schemas/ops-notice.ts': `import { z } from 'zod'

export default z.object({
  client: z.object({
    locale: z.string().optional().nullable(),
    name: z.string().optional(),
  }),
  kind: z.string(),
})
`,
  'src/emails/welcome.email.tsx': `import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Email, Trans, Vtex } from '@vtex-email/react'

export const settings = {
  i18n: {
    localePath: 'client.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function Welcome() {
  return (
    <Email>
      <Section>
        <Text>
          <Trans id="welcome.hello" /> <Vtex.Value path="client.name" />
        </Text>
      </Section>
    </Email>
  )
}
`,
  'src/emails/ops-notice.email.tsx': `import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Email, Trans, Vtex } from '@vtex-email/react'

export const settings = {
  i18n: {
    localePath: 'client.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function OpsNotice() {
  return (
    <Email>
      <Section>
        <Vtex.Eq fallback={<Text>other</Text>} path="kind" value="notice">
          <Text>
            <Trans id="ops.body" />
          </Text>
        </Vtex.Eq>
      </Section>
    </Email>
  )
}
`,
  'src/fixtures/welcome/full.jsonc': `{
  "meta": {
    "description": "Welcome with locale",
    "origin": "synthetic",
    "event": "welcome",
    "purpose": "preview",
    "expectedLocale": "en-US",
    "expect": "valid"
  },
  "data": {
    "client": {
      "locale": "en-US",
      "name": "${SEED_FREEZE_MARKER}"
    }
  }
}
`,
  'src/fixtures/welcome/missing-locale.jsonc': `{
  "meta": {
    "description": "Welcome missing locale",
    "origin": "synthetic",
    "event": "welcome",
    "purpose": "preview",
    "expectedLocale": "pt-BR",
    "expect": "valid"
  },
  "data": {
    "client": {
      "name": "${SEED_FREEZE_MARKER}"
    }
  }
}
`,
  'src/fixtures/welcome/unknown-locale.jsonc': `{
  "meta": {
    "description": "Welcome unknown locale",
    "origin": "synthetic",
    "event": "welcome",
    "purpose": "preview",
    "expectedLocale": "pt-BR",
    "expect": "valid"
  },
  "data": {
    "client": {
      "locale": "fr-FR",
      "name": "${SEED_FREEZE_MARKER}"
    }
  }
}
`,
  'src/fixtures/ops-notice/full.jsonc': `{
  "meta": {
    "description": "Ops notice",
    "origin": "synthetic",
    "event": "ops-notice",
    "purpose": "preview",
    "expectedLocale": "en-US",
    "expect": "valid"
  },
  "data": {
    "client": {
      "locale": "en-US",
      "name": "Ops"
    },
    "kind": "notice"
  }
}
`,
}

export interface SeedProject {
  root: string
  configPath: string
}

async function writeSeedFiles(root: string): Promise<string> {
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, contents)
  }
  await linkWorkspaceModules(root)
  return path.join(root, 'vtex-email.config.ts')
}

export async function createSeedProject(options?: { spaces?: boolean }): Promise<SeedProject> {
  const root = options?.spaces ? await createTempDirWithSpaces() : await createTempDir('vtex-seed-')
  const configPath = await writeSeedFiles(root)
  return { root, configPath }
}

export async function writeSeedInto(destination: string): Promise<SeedProject> {
  await mkdir(destination, { recursive: true })
  const configPath = await writeSeedFiles(destination)
  return { root: destination, configPath }
}
