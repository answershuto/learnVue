import { warn } from '../util/warn'

/* router-view组件 */
export default {
  name: 'RouterView',
  /* 
    https://cn.vuejs.org/v2/api/#functional
    使组件无状态 (没有 data ) 和无实例 (没有 this 上下文)。他们用一个简单的 render 函数返回虚拟节点使他们更容易渲染。
  */
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    /* 标记位，标记是route-view组件 */
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    /* 直接使用父组件的createElement函数 */
    const h = parent.$createElement
    /* props的name，默认'default' */
    const name = props.name
    /* option中的VueRouter对象 */
    const route = parent.$route
    /* 在parent上建立一个缓存对象 */
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    /* 记录组件深度 */
    let depth = 0
    /* 标记是否是待用（非alive状态）） */
    let inactive = false
    /* _routerRoot中中存放了根组件的势力，这边循环向上级访问，直到访问到根组件，得到depth深度 */
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        depth++
      }
      /* 如果_inactive为true，代表是在keep-alive中且是待用（非alive状态） */
      if (parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    /* 存放route-view组件的深度 */
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    /* 如果inactive为true说明在keep-alive组件中，直接从缓存中取 */
    if (inactive) {
      return h(cache[name], data, children)
    }

    const matched = route.matched[depth]
    // render empty node if no matched route
    /* 如果没有匹配到的路由，则渲染一个空节点 */
    if (!matched) {
      cache[name] = null
      return h()
    }

    /* 从成功匹配到的路由中取出组件 */
    const component = cache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    /* 注册实例的registration钩子，这个函数将在实例被注入的加入到组件的生命钩子（beforeCreate与destroyed）中被调用 */
    data.registerRouteInstance = (vm, val) => {  
      /* 第二个值不存在的时候为注销 */
      // val could be undefined for unregistration
      /* 获取组件实例 */
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        /* 这里有两种情况，一种是val存在，则用val替换当前组件实例，另一种则是val不存在，则直接将val（这个时候其实是一个undefined）赋给instances */
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // resolve props
    let propsToPass = data.props = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      propsToPass = data.props = extend({}, propsToPass)
      // pass non-declared props as attrs
      const attrs = data.attrs = data.attrs || {}
      for (const key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }

    return h(component, data, children)
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}

function extend (to, from) {
  for (const key in from) {
    to[key] = from[key]
  }
  return to
}
