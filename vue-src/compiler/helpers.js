/* @flow */

import { parseFilters } from './parser/filter-parser'

/*Vue 编译器警告*/
export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}

/*将属性放入ele的props属性中*/
export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
}

/*将属性放入ele的attr属性中*/
export function addAttr (el: ASTElement, name: string, value: string) {
  (el.attrs || (el.attrs = [])).push({ name, value })
}

/*将参数加入到ele的directives中去*/
export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  modifiers: ?ASTModifiers
) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
}

export function addHandler (
  el: ASTElement,
  name: string,
  value: string,
  modifiers: ?ASTModifiers,
  important?: boolean,
  warn?: Function
) {
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers && modifiers.prevent && modifiers.passive
  ) {
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    )
  }
  // check capture modifier
  if (modifiers && modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  if (modifiers && modifiers.once) {
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  /* istanbul ignore if */
  if (modifiers && modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }
  let events
  if (modifiers && modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }
  const newHandler = { value, modifiers }
  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    events[name] = newHandler
  }
}

export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  /*得到用:或者v-bind:修饰的特殊属性*/
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    /*存在特殊属性*/
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    /*getStatic非false的时候返回静态属性，即一般的属性*/
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

/*从ele的属性中获取name对应的值并将它从中删除*/
export function getAndRemoveAttr (el: ASTElement, name: string): ?string {
  let val
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  return val
}
