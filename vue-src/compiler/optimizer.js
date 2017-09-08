/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

/*标记是否为静态属性*/
let isStaticKey
/*标记是否是平台保留的标签*/
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
 /*
  将AST树进行优化
  优化的目标：生成模板AST树，检测不需要进行DOM改变的静态子树。
  一旦检测到这些静态树，我们就能做以下这些事情：
  1.把它们变成常数，这样我们就再也不需要每次重新渲染时创建新的节点了。
  2.在patch的过程中直接跳过。
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  /*标记是否为静态属性*/
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  /*标记是否是平台保留的标签*/
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  /*处理所有非静态节点*/
  markStatic(root)
  // second pass: mark static roots.
  /*处理static root*/
  markStaticRoots(root, false)
}

/*静态属性的map表*/
function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}

/*处理所有非静态节点*/
function markStatic (node: ASTNode) {
  /*标记一个node节点是否是static的*/
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    /*
      不要使组件slot成为静态的，避免下面这两种情况：
      1.
    */
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    /*遍历子节点*/
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      /*如果子节点不是静态的，则本身也不是静态的*/
      if (!child.static) {
        node.static = false
      }
    }
  }
}

function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      /*标记static的或者有v-once指令同时处于for循环中的节点*/
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    /*一个static root节点必须有子节点否则它可能只是一个static的文本节点，而且它不能只有文本子节点*/
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    /*遍历子节点*/
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    /*
      ifConditions存储了if条件。
      是一个数组，格式为[{exp: xxx, block:xxx}, {exp: xxx, block:xxx}, {exp: xxx, block:xxx}]
      block存储了element，exp存储了表达式。
    */
    if (node.ifConditions) {
      walkThroughConditionsBlocks(node.ifConditions, isInFor)
    }
  }
}

function walkThroughConditionsBlocks (conditionBlocks: ASTIfConditions, isInFor: boolean): void {
  for (let i = 1, len = conditionBlocks.length; i < len; i++) {
    markStaticRoots(conditionBlocks[i].block, isInFor)
  }
}

/*判断一个node节点是否是static的*/
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
/*Github:https://github.com/answershuto*/