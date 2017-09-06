/* @flow */

import { addProp } from 'compiler/helpers'
/*Github:https://github.com/answershuto*/
export default function text (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
