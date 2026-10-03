import type { Diagnostic } from '@vtex-email/core'

export type DevPhase = 'config' | 'compile' | 'server'

export type DevIngestPlan =
  | { kind: 'full' }
  | { kind: 'partial'; compile: string[]; fixtures: string[]; schemas: string[] }

export type DevNotice =
  | { kind: 'version'; version: string }
  | { kind: 'phase'; phase: DevPhase }
  | { kind: 'project'; name: string }
  | { kind: 'discovered'; emails: number; fixtures: number }
  | { kind: 'listening'; url: string }
  | {
      kind: 'startup'
      templatesReady: boolean
      elapsedMs: number
      diagnostics: readonly Diagnostic[]
    }
  | {
      kind: 'failed'
      exitCode: 1 | 2
      diagnostics: readonly Diagnostic[]
    }
  | {
      kind: 'ingest'
      plan: DevIngestPlan
      failed: boolean
      added: readonly string[]
      removed: readonly string[]
      diagnostics: readonly Diagnostic[]
    }
  | { kind: 'vite'; level: 'warn' | 'error'; message: string }
  | { kind: 'stopped' }

export type DevNoticeHandler = (notice: DevNotice) => void | Promise<void>
