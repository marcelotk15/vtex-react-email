export {
  normalizeOutput,
  sha256,
  type BuildManifest,
  type CompiledArtifact,
  type CompileEmailResult,
} from './compile/artifact'
export { assembleDocument, type AssembleDocumentInput } from './compile/assemble'
export { validateHandlebarsSyntax } from './compile/syntax'
export { unverifiedCapabilityDiagnostic } from './compile/target'
export {
  defineEmail,
  isSafeEmailId,
  type EmailDefinition,
  type EmailDocument,
  type EmailI18n,
  type EmailValidationOverride,
} from './define-email'
export { errorDiagnostic, warningDiagnostic, type Diagnostic, type DiagnosticSource, type Failure } from './diagnostics'
export { emitPath, parentHops, parsePath, type Expression, type PathResult } from './expression/path'
export { checkFixture, schemaMutates } from './fixture/check'
export { readPathValue, withForcedLocale } from './fixture/locale-path'
export { emitBlockClose, emitBlockOpen, emitHelperCall, emitInterpolation, emitLiteral } from './hbs/source'
export { checkCatalogs } from './i18n/catalog'
export { mergeLocaleDocuments } from './i18n/merge'
export { parseMessage, placeholderSignature, type MessagePart, type ParsedMessage } from './i18n/message'
export { bindSites, type BindResult } from './markers/bind'
export { restoreHandlebars, type RestoreResult } from './markers/restore'
export type { BlockName, DynamicAttribute, ResolvedPath, SiteArgument, SiteRecord } from './markers/sites'
export {
  mintToken,
  opaqueTokenIssue,
  scanTokens,
  TOKEN_BODY_LENGTH,
  TOKEN_LENGTH,
  TOKEN_PREFIX,
  type AttrMarker,
  type ElseMarker,
  type Marker,
  type OpenMarker,
  type TextMarker,
} from './markers/tokens'
export { commitArtifacts, releaseArtifacts } from './output/commit'
export {
  findCapability,
  syntaxHelperNames,
  type BlockHelper,
  type BlockOptions,
  type EmissionCapability,
  type EmissionProfile,
  type Evidence,
  type InlineHelper,
  type LocalSimulator,
  type Profile,
  type SimulatorHelper,
} from './profile'
export { singleDocumentIssue } from './runtime/document'
export { evaluateArtifact, renderTemplate, TemplateFailure } from './runtime/evaluate'
export { analyzePaths, analyzeRootPath } from './scope/analyze-paths'
export { nestSites, type ScopeArg, type ScopeBlock, type ScopeNode, type ScopeRef } from './scope/structure'
