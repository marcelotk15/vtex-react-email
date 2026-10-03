import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { packPublishablePackages } from '../tooling/release/pack-artifacts.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.env.RELEASE_ARTIFACTS_DIR
  ? path.resolve(process.env.RELEASE_ARTIFACTS_DIR)
  : path.join(root, '.release-artifacts')

const { manifest } = await packPublishablePackages({ root, outDir })
console.log(`Packed ${manifest.packages.length} package(s) into ${outDir}`)
for (const entry of manifest.packages) {
  console.log(`  ${entry.name}@${entry.version} ${entry.file} sha256=${entry.sha256.slice(0, 12)}…`)
}
