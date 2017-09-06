/* @flow */

import { addProp } from 'compiler/helpers'
/*Github:https://github.com/answershuto*/
export default function html (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`)
  }
}
