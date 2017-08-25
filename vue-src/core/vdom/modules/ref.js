/* @flow */

import { remove } from 'shared/util'

export default {
  create (_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    registerRef(vnode, true)
  }
}

/*注册一个ref（即在$refs中添加或者删除对应的Dom实例），isRemoval代表是增加还是移除，*/
export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  const key = vnode.data.ref
  if (!key) return

  const vm = vnode.context
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs
  if (isRemoval) {
    /*移除一个ref*/
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  } else {
    /*增加一个ref*/
    if (vnode.data.refInFor) {
      /*如果是在一个for循环中,则refs中key对应的是一个数组，里面存放了所有ref指向的Dom实例*/
      if (Array.isArray(refs[key]) && refs[key].indexOf(ref) < 0) {
        refs[key].push(ref)
      } else {
        refs[key] = [ref]
      }
    } else {
      /*不在一个for循环中则直接放入refs即可，ref指向Dom实例*/
      refs[key] = ref
    }
  }
}
