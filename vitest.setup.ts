import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertPinnedNode } from './tooling/node-pin'

const root = path.dirname(fileURLToPath(import.meta.url))
assertPinnedNode(path.join(root, '.nvmrc'))
