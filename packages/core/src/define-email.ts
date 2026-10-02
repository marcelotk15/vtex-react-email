import type { z } from 'zod'

export interface EmailDocument<TTemplate> {
  id: string
  event: string
  template: TTemplate
}

export interface EmailI18n {
  locales?: readonly string[]
  defaultLocale?: string
  localePath: string
  output?: 'per-locale' | 'merged'
  aliases?: Readonly<Record<string, string>>
}

export interface EmailValidationOverride {
  unknownPath?: 'error' | 'warning'
  warningsAsErrors?: boolean
}

/**
 * Public authoring overrides for an email module.
 * Omitted fields inherit from project config or file-key conventions.
 * Use with `export const settings = { ... } satisfies EmailSettings`.
 */
export interface EmailSettings {
  /** Template id. Defaults to the file key (basename without `.email.tsx`). */
  id?: string
  /**
   * Local metadata label for the email. Defaults to the file key.
   * Overriding this does not prove association with a real VTEX event.
   */
  event?: string
  /** Zod schema. Overrides `{schemasDir}/{fileKey}.ts` (default export) when set. */
  schema?: z.ZodType
  /**
   * Fixtures directory relative to the project config directory.
   * Overrides `{fixturesDir}/{fileKey}/`. Does not follow from `id`/`event`.
   */
  fixtures?: string
  /** Partial i18n overrides. Nested fields omit independently; arrays replace. */
  i18n?: EmailI18nSettings
  /** Partial validation overrides. */
  validation?: EmailValidationOverride
}

/**
 * Optional i18n fields on `EmailSettings`.
 * Each present field replaces the project/toolchain default; omitted fields inherit.
 */
export interface EmailI18nSettings {
  /** Locale list for this email. Replaces the project list when set. */
  locales?: readonly string[]
  /** Default locale for this email. */
  defaultLocale?: string
  /** Payload path used to read the locale. Overrides project `i18n.localePath`. */
  localePath?: string
  /** `per-locale` artifacts or a single `merged` document. Defaults to `merged`. */
  output?: 'per-locale' | 'merged'
  /** Alias map (`alias → locale`). Replaces entirely when set; no deep merge. */
  aliases?: Readonly<Record<string, string>>
}

/** Normalized email definition used after project resolution. Not the authoring API. */
export interface EmailDefinition<TTemplate> extends EmailDocument<TTemplate> {
  schema: z.ZodType
  /** Resolved fixtures directory relative to the project config directory. */
  fixtures: string
  i18n: EmailI18n
  validation?: EmailValidationOverride
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function isSafeEmailId(id: string): boolean {
  return SAFE_ID.test(id)
}
