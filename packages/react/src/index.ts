export {
  compileEmail,
  type BuildManifest,
  type CompileEmailInput,
  type CompileEmailResult,
  type CompiledArtifact,
} from './compile'
export { diagnoseStyles } from './styles'
export { Each, expr, Helper, If, Trans, Unless, Value, Vtex } from './dsl'
export { Email } from './email'
export { isExpression, type Expression } from './expr'
export { loadEmailEntry, type LoadEmailResult } from './load'
