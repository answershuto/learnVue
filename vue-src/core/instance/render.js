/* @flow */

import {
  warn,
  nextTick,
  toNumber,
  toString,
  looseEqual,
  emptyObject,
  handleError,
  looseIndexOf
} from '../util/index'

import VNode, {
  cloneVNodes,
  createTextVNode,
  createEmptyVNode
} from '../vdom/vnode'
/*Github:https://github.com/answershuto*/
import { createElement } from '../vdom/create-element'
import { renderList } from './render-helpers/render-list'
import { renderSlot } from './render-helpers/render-slot'
import { resolveFilter } from './render-helpers/resolve-filter'
import { checkKeyCodes } from './render-helpers/check-keycodes'
import { bindObjectProps } from './render-helpers/bind-object-props'
import { renderStatic, markOnce } from './render-helpers/render-static'
import { resolveSlots, resolveScopedSlots } from './render-helpers/resolve-slots'

/*初始化render*/
export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree
  vm._staticTrees = null
  const parentVnode = vm.$vnode = vm.$options._parentVnode // the placeholder node in parent tree  父树中的占位符节点
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(vm.$options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /*将createElement函数绑定到该实例上，该vm存在闭包中，不可修改，vm实例则固定。这样我们就可以得到正确的上下文渲染*/
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  /*常规方法呗用于公共版本，被用来作为用户界面的渲染方法*/
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
}

export function renderMixin (Vue: Class<Component>) {
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  /*_render渲染函数，返回一个VNode节点*/
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const {
      render,
      staticRenderFns,
      _parentVnode
    } = vm.$options

    if (vm._isMounted) {
      // clone slot nodes on re-renders
      /*在重新渲染时会克隆槽位节点 不知道是不是因为Vnode必须必须唯一的原因，网上也没找到答案，此处存疑。*/
      for (const key in vm.$slots) {
        vm.$slots[key] = cloneVNodes(vm.$slots[key])
      }
    }

    /*作用域slot*/
    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    if (staticRenderFns && !vm._staticTrees) {
      /*用来存放static节点，已经被渲染的并且不存在v-for中的static节点不需要重新渲染，只需要进行浅拷贝*/
      vm._staticTrees = []
    }
    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode
    // render self
    /*渲染*/
    let vnode
    try {
      /*调用render函数，返回一个VNode节点*/
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render function`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        vnode = vm.$options.renderError
          ? vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          : vm._vnode
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    /*如果VNode节点没有创建成功则创建一个空节点*/
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }

  // internal render helpers.
  // these are exposed on the instance prototype to reduce generated render
  // code size.
  /*
    内部处理render的函数
    这些函数会暴露在Vue原型上以减小渲染函数大小
  */
  /*处理v-once的渲染函数*/
  Vue.prototype._o = markOnce
  /*将字符串转化为数字，如果转换失败会返回原字符串*/
  Vue.prototype._n = toNumber
  /*将val转化成字符串*/
  Vue.prototype._s = toString
  /*处理v-for列表渲染*/
  Vue.prototype._l = renderList
  /*处理slot的渲染*/
  Vue.prototype._t = renderSlot
  /*检测两个变量是否相等*/
  Vue.prototype._q = looseEqual
  /*检测arr数组中是否包含与val变量相等的项*/
  Vue.prototype._i = looseIndexOf
  /*处理static树的渲染*/
  Vue.prototype._m = renderStatic
  /*处理filters*/
  Vue.prototype._f = resolveFilter
  /*从config配置中检查eventKeyCode是否存在*/
  Vue.prototype._k = checkKeyCodes
  /*合并v-bind指令到VNode中*/
  Vue.prototype._b = bindObjectProps
  /*创建一个文本节点*/
  Vue.prototype._v = createTextVNode
  /*创建一个空VNode节点*/
  Vue.prototype._e = createEmptyVNode
  /*处理ScopedSlots*/
  Vue.prototype._u = resolveScopedSlots
}
