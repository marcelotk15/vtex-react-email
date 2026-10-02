import { DynamicButton, DynamicImg, DynamicLink } from './attributes'
import { Each, If, Unless } from './blocks'
import { expr } from './expr'
import { Trans } from './trans'
import { Helper, Value } from './values'

export const Vtex = {
  Each,
  If,
  Unless,
  Value,
  Helper,
  Link: DynamicLink,
  Img: DynamicImg,
  Button: DynamicButton,
}

export { Each, expr, Helper, If, Trans, Unless, Value }
