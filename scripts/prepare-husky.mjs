import { execFileSync } from 'node:child_process'
import { access, constants } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const accessAsync = promisify(access)
const root = process.cwd()
const huskyBin = path.join(root, 'node_modules/husky/bin.js')

function envDisabled() {
  const value = process.env.HUSKY
  return value === '0' || value === 'false'
}

async function pathExists(filePath) {
  try {
    await accessAsync(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function readHooksPath() {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

async function main() {
  if (envDisabled()) {
    console.log('prepare-husky: HUSKY disabled; skipping')
    return
  }

  if (!(await pathExists(path.join(root, '.git')))) {
    console.log('prepare-husky: no .git directory; skipping hook install')
    return
  }

  if (!(await pathExists(huskyBin))) {
    console.warn('prepare-husky: husky is unavailable; skipping hook install')
    return
  }

  const hooksPath = readHooksPath()
  if (hooksPath) {
    const normalized = hooksPath.replaceAll('\\', '/')
    if (!normalized.includes('.husky')) {
      console.warn(
        `prepare-husky: core.hooksPath is already set to "${hooksPath}"; not overriding. Unset it to use repo husky hooks.`,
      )
      return
    }
  }

  execFileSync(process.execPath, [huskyBin], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, HUSKY: '1' },
  })
}

await main()
