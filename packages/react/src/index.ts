export { Email } from './adapter/email'
export { diagnoseStyles } from './adapter/style-diagnostics'
export {
  compileEmail,
  type BuildManifest,
  type CompiledArtifact,
  type CompileEmailInput,
  type CompileEmailResult,
} from './compile/compile-email'
export { isExpression, type Expression } from './dsl/expr'
export {
  Each,
  Eq,
  expr,
  Group,
  HasSubStr,
  Helper,
  If,
  IfCond,
  Math,
  RichShippingData,
  Trans,
  Unless,
  Value,
  Vtex,
  With,
} from './dsl/vtex'
