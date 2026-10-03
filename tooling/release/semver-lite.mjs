/**
 * Minimal semver helpers for release gates (avoids adding a root dependency).
 */

/** @param {string} version */
export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  }
}

/**
 * @param {string} version
 * @param {string} range
 */
export function satisfiesRange(version, range) {
  const trimmed = range.trim()
  if (trimmed === '*' || trimmed === 'x' || trimmed === '') return true
  const parsedVersion = parseVersion(version)
  if (!parsedVersion) return false

  if (/^[=~^]?$/.test(trimmed)) return false

  if (trimmed.startsWith('^')) {
    const base = parseVersion(trimmed.slice(1))
    if (!base) return false
    if (base.major === 0) {
      if (parsedVersion.major !== 0) return false
      if (base.minor === 0) {
        return parsedVersion.minor === 0 && parsedVersion.patch === base.patch && !parsedVersion.prerelease
      }
      return parsedVersion.minor === base.minor && parsedVersion.patch >= base.patch && !parsedVersion.prerelease
    }
    return (
      parsedVersion.major === base.major &&
      (parsedVersion.minor > base.minor || (parsedVersion.minor === base.minor && parsedVersion.patch >= base.patch)) &&
      !parsedVersion.prerelease
    )
  }

  if (trimmed.startsWith('~')) {
    const base = parseVersion(trimmed.slice(1))
    if (!base) return false
    return (
      parsedVersion.major === base.major &&
      parsedVersion.minor === base.minor &&
      parsedVersion.patch >= base.patch &&
      !parsedVersion.prerelease
    )
  }

  const exact = parseVersion(trimmed)
  if (!exact) return false
  return (
    exact.major === parsedVersion.major &&
    exact.minor === parsedVersion.minor &&
    exact.patch === parsedVersion.patch &&
    exact.prerelease === parsedVersion.prerelease
  )
}
