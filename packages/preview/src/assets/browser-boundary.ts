import path from 'node:path'

const nodeBuiltins = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'fs',
  'fs/promises',
  'module',
  'os',
  'path',
  'url',
  'util',
])

export function browserImportViolation(specifier: string): string | null {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) return null
  const blocked =
    specifier.startsWith('node:') ||
    nodeBuiltins.has(specifier) ||
    specifier === '@vtex-email/cli' ||
    specifier.startsWith('@vtex-email/cli/') ||
    specifier === '@vtex-email/core' ||
    specifier.startsWith('@vtex-email/core/') ||
    specifier === '@vtex-email/react' ||
    specifier.startsWith('@vtex-email/react/') ||
    specifier.startsWith('@react-email/') ||
    specifier === 'react-dom/server' ||
    specifier.startsWith('react-dom/server/')
  if (!blocked) return null
  return `The preview interface cannot import ${specifier}.`
}
