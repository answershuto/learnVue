/* @flow */

import { genHandlers } from './events'
import { baseWarn, pluckModuleFunction } from '../helpers'
import baseDirectives from '../directives/index'
import { camelize, no } from 'shared/util'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;

// configurable state
let warn
let transforms: Array<TransformFunction>
let dataGenFns: Array<DataGenFunction>
let platformDirectives
let isPlatformReservedTag
let staticRenderFns
let onceCount
let currentOptions

/*将AST语法树转化成render以及staticRenderFns的字符串*/
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): {
  render: string,
  staticRenderFns: Array<string>
} {
  // save previous staticRenderFns so generate calls can be nested
  const prevStaticRenderFns: Array<string> = staticRenderFns
  const currentStaticRenderFns: Array<string> = staticRenderFns = []
  const prevOnceCount = onceCount
  onceCount = 0
  currentOptions = options
  warn = options.warn || baseWarn
  transforms = pluckModuleFunction(options.modules, 'transformCode')
  dataGenFns = pluckModuleFunction(options.modules, 'genData')
  platformDirectives = options.directives || {}
  isPlatformReservedTag = options.isReservedTag || no
  const code = ast ? genElement(ast) : '_c("div")'
  staticRenderFns = prevStaticRenderFns
  onceCount = prevOnceCount
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: currentStaticRenderFns
  }
}

/*处理element，分别处理static静态节点、v-once、v-for、v-if、template、slot以及组件或元素*/
function genElement (el: ASTElement): string {
  if (el.staticRoot && !el.staticProcessed) {
    /*处理static静态节点*/
    return genStatic(el)
  } else if (el.once && !el.onceProcessed) {
    /*处理v-once*/
    return genOnce(el)
  } else if (el.for && !el.forProcessed) {
    /*处理v-for*/
    return genFor(el)
  } else if (el.if && !el.ifProcessed) {
    /*处理v-if*/
    return genIf(el)
  } else if (el.tag === 'template' && !el.slotTarget) {
    /*处理template*/
    return genChildren(el) || 'void 0'
  } else if (el.tag === 'slot') {
    /*处理slot*/
    return genSlot(el)
  } else {
    // component or element
    /*处理组件或元素*/
    let code
    if (el.component) {
      code = genComponent(el.component, el)
    } else {
      const data = el.plain ? undefined : genData(el)

      const children = el.inlineTemplate ? null : genChildren(el, true)
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // module transforms
    for (let i = 0; i < transforms.length; i++) {
      code = transforms[i](el, code)
    }
    return code
  }
}

// hoist static sub-trees out
/*处理static静态节点*/
function genStatic (el: ASTElement): string {
  /*处理过的标记位*/
  el.staticProcessed = true
  staticRenderFns.push(`with(this){return ${genElement(el)}}`)
  return `_m(${staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
/*处理v-once*/
function genOnce (el: ASTElement): string {
  /*处理过的标记位*/
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    /*同时还存在v-if的时候需要处理v-if*/
    return genIf(el)
  } else if (el.staticInFor) {
    /*
      staticInFor标记static的或者有v-once指令同时处于for循环中的节点。
      此时表示同时存在于for循环中
      */
    let key = ''
    let parent = el.parent
    /*向上逐级寻找所处的for循环*/
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    if (!key) {
      /*如果v-once出现在for循环中，那必须要给设置v-for的element设置key*/
      process.env.NODE_ENV !== 'production' && warn(
        `v-once can only be used inside v-for that is keyed. `
      )
      return genElement(el)
    }
    return `_o(${genElement(el)},${onceCount++}${key ? `,${key}` : ``})`
  } else {
    return genStatic(el)
  }
}

/*处理v-if*/
function genIf (el: any): string {
  /*标记位*/
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice())
}

/*处理if条件*/
function genIfConditions (conditions: ASTIfConditions): string {
  /*表达式不存在*/
  if (!conditions.length) {
    return '_e()'
  }

  const condition = conditions.shift()
  if (condition.exp) {
    return `(${condition.exp})?${genTernaryExp(condition.block)}:${genIfConditions(conditions)}`
  } else {
    return `${genTernaryExp(condition.block)}`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  /*v-if与v-once同时存在的时候应该使用三元运算符，譬如说(a)?_m(0):_m(1)*/
  function genTernaryExp (el) {
    return el.once ? genOnce(el) : genElement(el)
  }
}

/*处理v-for循环*/
function genFor (el: any): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  if (
    process.env.NODE_ENV !== 'production' &&
    maybeComponent(el) && el.tag !== 'slot' && el.tag !== 'template' && !el.key
  ) {
    warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }

  /*标记位，避免递归*/
  el.forProcessed = true // avoid recursion
  return `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${genElement(el)}` +
    '})'
}

function genData (el: ASTElement): string {
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el)
  if (dirs) data += dirs + ','

  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute
  if (el.component) {
    data += `tag:"${el.tag}",`
  }
  // module data generation functions
  for (let i = 0; i < dataGenFns.length; i++) {
    data += dataGenFns[i](el)
  }
  // attributes
  if (el.attrs) {
    data += `attrs:{${genProps(el.attrs)}},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:{${genProps(el.props)}},`
  }
  // event handlers
  if (el.events) {
    data += `${genHandlers(el.events, false, warn)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true, warn)},`
  }
  // slot target
  if (el.slotTarget) {
    data += `slot:${el.slotTarget},`
  }
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots)},`
  }
  // component v-model
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }
  // inline-template
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  data = data.replace(/,$/, '') + '}'
  // v-bind data wrap
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  return data
}

function genDirectives (el: ASTElement): string | void {
  const dirs = el.directives
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    needRuntime = true
    const gen: DirectiveFunction = platformDirectives[dir.name] || baseDirectives[dir.name]
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, warn)
    }
    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}

function genInlineTemplate (el: ASTElement): ?string {
  const ast = el.children[0]
  if (process.env.NODE_ENV !== 'production' && (
    el.children.length > 1 || ast.type !== 1
  )) {
    warn('Inline-template components must have exactly one child element.')
  }
  if (ast.type === 1) {
    const inlineRenderFns = generate(ast, currentOptions)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
  }
}

function genScopedSlots (slots: { [key: string]: ASTElement }): string {
  return `scopedSlots:_u([${
    Object.keys(slots).map(key => genScopedSlot(key, slots[key])).join(',')
  }])`
}

function genScopedSlot (key: string, el: ASTElement) {
  return `[${key},function(${String(el.attrsMap.scope)}){` +
    `return ${el.tag === 'template'
      ? genChildren(el) || 'void 0'
      : genElement(el)
  }}]`
}

/*处理chidren*/
function genChildren (el: ASTElement, checkSkip?: boolean): string | void {
  const children = el.children
  if (children.length) {
    const el: any = children[0]
    // optimize single v-for
    /*优化单个v-for*/
    if (children.length === 1 &&
        el.for &&
        el.tag !== 'template' &&
        el.tag !== 'slot') {
      return genElement(el)
    }
    const normalizationType = checkSkip ? getNormalizationType(children) : 0
    /*用genNode处理children，内部有子节点也会继续遍历*/
    return `[${children.map(genNode).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/*
  得到子数组所需的序列化类型
  0:不需要序列化
  1:需要做简单的序列化（可能是一级深层嵌套数组）
  2:需要完全序列化
*/
function getNormalizationType (children: Array<ASTNode>): number {
  let res = 0
  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    /*当不是元素节点的时候直接continue*/
    if (el.type !== 1) {
      continue
    }
    /*if条件中是存在满足needsNormalization条件的*/
    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      res = 2
      break
    }
    /*if条件中有满足有可能是组件的返回1*/
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      res = 1
    }
  }
  return res
}

/*是否需要序列化（元素不是slot标签或者templete，同时不存在于v-for循环中）*/
function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

/*有可能是组件（判断不是平台保留标签，就是组件，当然也有可能是一个乱七八糟的标签并不在compoments中，这个后面在compoments中寻找组件的地方会处理）*/
function maybeComponent (el: ASTElement): boolean {
  return !isPlatformReservedTag(el.tag)
}

/*处理节点*/
function genNode (node: ASTNode): string {
  if (node.type === 1) {
    return genElement(node)
  } else {
    return genText(node)
  }
}

/*处理文本*/
function genText (text: ASTText | ASTExpression): string {
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}
/*Github:https://github.com/answershuto*/
function genSlot (el: ASTElement): string {
  /*不存在slotName的时候改slot的name为default*/
  const slotName = el.slotName || '"default"'
  const children = genChildren(el)
  let res = `_t(${slotName}${children ? `,${children}` : ''}`
  const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
/*处理compoment*/
function genComponent (componentName: string, el: ASTElement): string {
  const children = el.inlineTemplate ? null : genChildren(el, true)
  return `_c(${componentName},${genData(el)}${
    children ? `,${children}` : ''
  })`
}

function genProps (props: Array<{ name: string, value: string }>): string {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
  }
  return res.slice(0, -1)
}

// #3895, #4268
function transformSpecialNewlines (text: string): string {
  return text
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
