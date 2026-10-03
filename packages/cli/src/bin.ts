import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parseArgs } from './commands/args'
import { run } from './commands/run'

const parsed = parseArgs(process.argv)
const code = await run(parsed, process.cwd(), packageVersion())
process.exit(code)

function packageVersion(): string {
  const file = fileURLToPath(new URL('../package.json', import.meta.url))
  const parsedFile = JSON.parse(readFileSync(file, 'utf8')) as { version?: string }
  return parsedFile.version ?? '0.0.0'
}
