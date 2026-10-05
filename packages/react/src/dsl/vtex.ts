import { DynamicButton, DynamicImg, DynamicLink } from './attributes'
import { Each, Eq, Group, HasSubStr, If, IfCond, Math, RichShippingData, Unless, With } from './blocks'
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
  With,
  Math,
  RichShippingData,
  Value,
  Helper,
  Link: DynamicLink,
  Img: DynamicImg,
  Button: DynamicButton,
}

export { Each, Eq, expr, Group, HasSubStr, Helper, If, IfCond, Math, RichShippingData, Trans, Unless, Value, With }
