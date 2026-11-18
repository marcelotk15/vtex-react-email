import { attributeToken, DynamicButton, DynamicImg, DynamicLink } from './attributes'
import { Compare, Each, Eq, Group, HasSubStr, If, IfCond, Math, RichShippingData, Unless, With } from './blocks'
import { expr } from './expr'
import { Trans } from './trans'
import { Eval, Helper, Value } from './values'

export const Vtex = {
  Each,
  If,
  Unless,
  IfCond,
  Compare,
  HasSubStr,
  Group,
  Eq,
  With,
  Math,
  RichShippingData,
  Value,
  Helper,
  Eval,
  Link: DynamicLink,
  Img: DynamicImg,
  Button: DynamicButton,
  attr: attributeToken,
}

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
  Compare,
  Math,
  RichShippingData,
  Trans,
  Unless,
  Value,
  With,
}
