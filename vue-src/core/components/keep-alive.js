/* @flow */

import { isRegExp } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

const patternTypes: Array<Function> = [String, RegExp]

/* 获取组件名称 */
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

/* 检测name是否匹配 */
function matches (pattern: string | RegExp, name: string): boolean {
  if (typeof pattern === 'string') {
    /* 字符串情况，如a,b,c */
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    /* 正则 */
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

/* 修正cache */
function pruneCache (cache: VNodeCache, current: VNode, filter: Function) {
  for (const key in cache) {
    /* 取出cache中的vnode */
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      /* name不符合filter条件的，同时不是目前渲染的vnode时，销毁vnode对应的组件实例（Vue实例），并从cache中移除 */
      if (name && !filter(name)) {
        if (cachedNode !== current) {
          pruneCacheEntry(cachedNode)
        }
        cache[key] = null
      }
    }
  }
}

/* 销毁vnode对应的组件实例（Vue实例） */
function pruneCacheEntry (vnode: ?VNode) {
  if (vnode) {
    vnode.componentInstance.$destroy()
  }
}

/* keep-alive组件 */
export default {
  name: 'keep-alive',
  /* 抽象组件 */
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes
  },

  created () {
    /* 缓存对象 */
    this.cache = Object.create(null)
  },

  /* destroyed钩子中销毁所有cache中的组件实例 */
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache[key])
    }
  },

  watch: {
    /* 监视include以及exclude，在被修改的时候对cache进行修正 */
    include (val: string | RegExp) {
      pruneCache(this.cache, this._vnode, name => matches(val, name))
    },
    exclude (val: string | RegExp) {
      pruneCache(this.cache, this._vnode, name => !matches(val, name))
    }
  },

  render () {
    /* 得到slot插槽中的第一个组件 */
    const vnode: VNode = getFirstComponentChild(this.$slots.default)

    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      /* 获取组件名称，优先获取组件的name字段，否则是组件的tag */
      const name: ?string = getComponentName(componentOptions)
      /* name不在inlcude中或者在exlude中则直接返回vnode（没有取缓存） */
      if (name && (
        (this.include && !matches(this.include, name)) ||
        (this.exclude && matches(this.exclude, name))
      )) {
        return vnode
      }
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      /* 如果已经做过缓存了则直接从缓存中获取组件实例给vnode，还未缓存过则进行缓存 */
      if (this.cache[key]) {
        vnode.componentInstance = this.cache[key].componentInstance
      } else {
        this.cache[key] = vnode
      }
      /* keepAlive标记位 */
      vnode.data.keepAlive = true
    }
    return vnode
  }
}
