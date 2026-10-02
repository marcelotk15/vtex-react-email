export { bindSites, type BindResult } from './bind'
export {
  defineEmail,
  isSafeEmailId,
  type EmailDefinition,
  type EmailDocument,
  type EmailI18n,
  type EmailValidationOverride,
} from './define-email'
export { errorDiagnostic, warningDiagnostic, type Diagnostic, type DiagnosticSource } from './diagnostics'
export {
  emitBlockClose,
  emitBlockOpen,
  emitHelperCall,
  emitInterpolation,
  emitLiteral,
  emitPath,
  parentHops,
  parsePath,
  type Expression,
  type PathResult,
} from './emit'
export { checkFixture, schemaMutates } from './fixture'
export { checkCatalogs, sha256 } from './hash'
export { withForcedLocale } from './locale-value'
export { parseMessage, placeholderSignature, type MessagePart, type ParsedMessage } from './message'
export { mergeLocaleDocuments, singleDocumentIssue } from './merge'
export { assertPinnedNode } from './node-pin'
export type {
  BlockHelper,
  BlockName,
  BlockOptions,
  DynamicAttribute,
  EmissionCapability,
  EmissionProfile,
  Evidence,
  InlineHelper,
  LocalSimulator,
  Profile,
  ResolvedPath,
  SimulatorHelper,
  SiteArgument,
  SiteRecord,
} from './profile'
export { analyzePaths, analyzeRootPath } from './paths'
export { restoreHandlebars, type RestoreResult } from './restore'
export { nestSites, type ScopeArg, type ScopeBlock, type ScopeNode, type ScopeRef } from './structure'
export {
  evaluateArtifact,
  releaseArtifacts,
  renderTemplate,
  syntaxHelperNames,
  TemplateFailure,
  validateHandlebarsSyntax,
} from './runtime'
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
} from './tokens'
export { commitArtifacts, normalizeOutput } from './write'
