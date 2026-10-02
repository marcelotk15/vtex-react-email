import { executeProof } from './run-proof'

executeProof().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'The proof failed.'
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
