import { DynamicButton, DynamicImg, DynamicLink } from './attributes'
import { Each, Eq, Group, HasSubStr, If, IfCond, Unless } from './blocks'
import { expr } from './expr'
import { Trans } from './trans'
import { Helper, Value } from './values'

export const Vtex = {
  Each,
  If,
  Unless,
  IfCond,
  HasSubStr,
  Group,
  Eq,
  Value,
  Helper,
  Link: DynamicLink,
  Img: DynamicImg,
  Button: DynamicButton,
}

export { Each, Eq, expr, Group, HasSubStr, Helper, If, IfCond, Trans, Unless, Value }
