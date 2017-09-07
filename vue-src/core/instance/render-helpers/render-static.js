/* @flow */

import { cloneVNode, cloneVNodes } from 'core/vdom/vnode'

/**
 * Runtime helper for rendering static trees.
 */
 /*处理static树的渲染*/
export function renderStatic (
  index: number,
  isInFor?: boolean
): VNode | Array<VNode> {
  /*从_staticTrees中取出tree，如果已经被渲染则会存在*/
  let tree = this._staticTrees[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree by doing a shallow clone.
  /*如果已经被渲染的static tree并且它不是在v-for中，我们能够通过浅拷贝来重用同一棵树*/
  if (tree && !isInFor) {
    return Array.isArray(tree)
      ? cloneVNodes(tree)
      : cloneVNode(tree)
  }
  // otherwise, render a fresh tree.
  /*否则渲染一刻新的树，同时存储在_staticTrees中，供上面检测是否已经渲染过*/
  tree = this._staticTrees[index] =
    this.$options.staticRenderFns[index].call(this._renderProxy)
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
 /*处理v-once的渲染函数*/
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  /*处理static节点*/
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

/*处理static节点*/
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
