export { Email, type EmailProps } from './adapter/email'
export { diagnoseStyles } from './adapter/style-diagnostics'
export {
  compileEmail,
  type BuildManifest,
  type CompiledArtifact,
  type CompileEmailInput,
  type CompileEmailResult,
} from './compile/compile-email'
export { attributeToken, type AttributeValue } from './dsl/attributes'
export { isExpression, type Expression } from './dsl/expr'
export {
  Each,
  Eq,
  Eval,
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
