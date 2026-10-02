import { buildProject, validateProject } from '@vtex-email/cli'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = process.env.VTEX_EMAIL_PROJECT_DIR ?? path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(projectDir, 'vtex-email.config.ts')
const command = process.argv[2]
const result =
  command === 'validate'
    ? await validateProject({ configPath })
    : await buildProject({ configPath, write: command !== 'validate' })

if (!result.ok) {
  console.error(result.diagnostics.map((item) => `${item.code} ${item.message}`).join('\n'))
  process.exit(result.exitCode)
}
