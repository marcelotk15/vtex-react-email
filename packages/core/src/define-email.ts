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

export interface EmailDefinition<TTemplate> extends EmailDocument<TTemplate> {
  schema: z.ZodType
  fixtures: string
  i18n: EmailI18n
  validation?: EmailValidationOverride
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function isSafeEmailId(id: string): boolean {
  return SAFE_ID.test(id)
}

export function defineEmail<TTemplate>(definition: EmailDefinition<TTemplate>): EmailDefinition<TTemplate> {
  return definition
}
