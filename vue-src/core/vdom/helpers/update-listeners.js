/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef } from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

/*返回一个函数，该函数的作用是将生成时的fns执行，如果fns是数组，则便利执行它的每一项*/
export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      for (let i = 0; i < fns.length; i++) {
        fns[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}

/*更新监听事件*/
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, cur, old, event
  /*遍历新事件的所有方法*/
  for (name in on) {
    cur = on[name]
    old = oldOn[name]

    /*取得并去除事件的~、!、&等前缀*/
    event = normalizeEvent(name)
    /*isUndef用于判断传入对象不等于undefined或者null*/
    if (isUndef(cur)) {
      /*新方法不存在抛出打印*/
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        /*createFnInvoker返回一个函数，该函数的作用是将生成时的fns执行，如果fns是数组，则便利执行它的每一项*/
        cur = on[name] = createFnInvoker(cur)
      }
      add(event.name, cur, event.once, event.capture, event.passive)
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }
  /*移除所有旧的事件*/
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
