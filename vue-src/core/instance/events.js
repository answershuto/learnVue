/* @flow */

import { updateListeners } from '../vdom/helpers/index'
import { toArray, tip, hyphenate, formatComponentName } from '../util/index'

/*初始化事件*/
export function initEvents (vm: Component) {
  /*在vm上创建一个_events对象，用来存放事件。*/
  vm._events = Object.create(null)
  /*这个bool标志位来表明是否存在钩子，而不需要通过哈希表的方法来查找是否有钩子，这样做可以减少不必要的开销，优化性能。*/
  vm._hasHookEvent = false
  // init parent attached events
  /*初始化父组件attach的事件*/
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

/*有once的时候注册一个只会触发一次的方法，没有once的时候注册一个事件方法*/
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

/*销毁一个事件方法*/
function remove (event, fn) {
  target.$off(event, fn)
}

/*更新组件的监听事件*/
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}
/*Github:https://github.com/answershuto*/
/*为Vue原型加入操作事件的方法*/
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

  /*在vm实例上绑定事件方法*/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this

    /*如果是数组的时候，则递归$on，为每一个成员都绑定上方法*/
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      /*这里在注册事件的时候标记bool值也就是个标志位来表明存在钩子，而不需要通过哈希表的方法来查找是否有钩子，这样做可以减少不必要的开销，优化性能。*/
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /*注册一个只执行一次的事件方法*/
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      /*在第一次执行的时候将该事件销毁*/
      vm.$off(event, on)
      /*执行注册的方法*/
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /*注销一个事件，如果不传参则注销所有事件，如果只传event名则注销该event下的所有方法*/
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    /*如果不传参数则注销所有事件*/
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    /*如果event是数组则递归注销事件*/
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    /*本身不存在该事件则直接返回*/
    if (!cbs) {
      return vm
    }
    /*如果只传了event参数则注销该event方法下的所有方法*/
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    /*遍历寻找对应方法并删除*/
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  /*触发一个事件方法*/
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      /*将类数组的对象转换成数组*/
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      /*遍历执行*/
      for (let i = 0, l = cbs.length; i < l; i++) {
        cbs[i].apply(vm, args)
      }
    }
    return vm
  }
}
