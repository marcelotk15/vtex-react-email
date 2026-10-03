export type { DevIngestPlan, DevNotice, DevNoticeHandler, DevPhase } from './commands/dev-notices'
export { publishDiagnostics, type CliDiagnostic } from './commands/report'
export { type ResolvedConfig } from './config/config'
export { loadProjectConfig } from './config/load-config'
export { buildProject, validateProject } from './project/build-project'
export { duplicateId } from './project/discover'
export { importBundled } from './project/module-loader'
export { exportPreview, previewBuiltEmail, refreshEmailFixtures, renderPreview } from './project/preview-evaluation'
export { revalidateEmail } from './project/revalidate'
export {
  exitOk,
  exitUsage,
  exitValidation,
  type BuiltEmail,
  type BuiltFile,
  type FixtureMeta,
  type LoadedFixture,
  type PreviewResult,
  type ProjectManifest,
  type ProjectResult,
} from './project/types'
