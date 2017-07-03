/* @flow */

import { decode } from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { cached, no, camelize } from 'shared/util'
import { genAssignmentCode } from '../directives/model'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'

/*匹配@以及v-on，绑定事件 */
export const onRE = /^@|^v-on:/
/*匹配v-、@以及:*/
export const dirRE = /^v-|^@|^:/
/*匹配v-for中的in以及of*/
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
/*v-for参数中带括号的情况匹配，比如(item, index)这样的参数*/
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/

const argRE = /:(.*)$/
const bindRE = /^:|^v-bind:/
const modifierRE = /\.[^.]+/g

const decodeHTMLCached = cached(decode)

// configurable state
export let warn
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

/**
 * Convert HTML string to AST.
 */
 /*将HTML字符串转换成AST*/
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  /*警告函数，baseWarn是Vue 编译器默认警告*/
  warn = options.warn || baseWarn 
  platformGetTagNamespace = options.platformGetTagNamespace || no
  platformMustUseProp = options.mustUseProp || no
  /*检测是否是<pre>标签*/
  platformIsPreTag = options.isPreTag || no
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  transforms = pluckModuleFunction(options.modules, 'transformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')
  delimiters = options.delimiters

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent
  /*标志位，是否有v-pre属性*/
  let inVPre = false
  /*标志位，是否是pre标签*/
  let inPre = false
  let warned = false

  /*只发出一次的warning*/
  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

  function endPre (element) {
    // check pre state
    /*是否有v-pre属性，存在则标志位变为false，因为这里已经是结束end，存在v-pre时在start中会被标志为true*/
    if (element.pre) {
      inVPre = false
    }
    /*检测是否是<pre>标签*/
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
  }

  /*解析HTML*/
  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      /*处理IE的svg bug*/
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      const element: ASTElement = {
        type: 1,
        tag,
        attrsList: attrs,
        attrsMap: makeAttrsMap(attrs),
        parent: currentParent,
        children: []
      }
      if (ns) {
        element.ns = ns
      }

      /*如果是被禁止的标签或者是服务端渲染*/
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        preTransforms[i](element, options)
      }

      if (!inVPre) {
        /*
          处理v-pre属性
          v-pre元素及其子元素被跳过编译
          https://cn.vuejs.org/v2/api/#v-pre
        */
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      /*检测是否是<pre>标签*/
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      /*如果有v-pre属性，元素及其子元素不会被编译*/
      if (inVPre) {
        processRawAttrs(element)
      } else {
        /*匹配v-for属性*/
        processFor(element)
        /*匹配if属性，分别处理v-if、v-else以及v-else-if属性*/
        processIf(element)
        /*处理v-once属性，https://cn.vuejs.org/v2/api/#v-once*/
        processOnce(element)
        /*处理key属性 https://cn.vuejs.org/v2/api/#key*/
        processKey(element)

        // determine whether this is a plain element after
        // removing structural attributes
        /*去掉属性后，确定这是一个普通元素。*/
        element.plain = !element.key && !attrs.length

        /*处理ref属性 https://cn.vuejs.org/v2/api/#ref*/
        processRef(element)
        processSlot(element)
        processComponent(element)
        for (let i = 0; i < transforms.length; i++) {
          transforms[i](element, options)
        }
        processAttrs(element)
      }

      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // tree management
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        endPre(element)
      }
      // apply post-transforms
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    },

    end () {
      // remove trailing whitespace
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      endPre(element)
    },

    chars (text: string) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
          currentParent.tag === 'textarea' &&
          currentParent.attrsMap.placeholder === text) {
        return
      }
      const children = currentParent.children
      text = inPre || text.trim()
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        : preserveWhitespace && children.length ? ' ' : ''
      if (text) {
        let expression
        if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    }
  })
  return root
}

/*
  处理v-pre属性
  v-pre元素及其子元素被跳过编译
  https://cn.vuejs.org/v2/api/#v-pre
*/
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

/*处理原生属性，将其放入attrs中，以{name, value}的形式*/
function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

/*处理key属性 https://cn.vuejs.org/v2/api/#key*/
function processKey (el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}

/*处理ref属性 https://cn.vuejs.org/v2/api/#ref*/
function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    /*
      检测该元素是否存在一个for循环中。
      将会沿着parent元素一级一级向上便利寻找是否处于一个for循环中。
      当 v-for 用于元素或组件的时候，引用信息将是包含 DOM 节点或组件实例的数组。
    */
    el.refInFor = checkInFor(el)
  }
}

/*匹配v-for属性*/
function processFor (el) {
  let exp
  /*取出v-for属性*/
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    /*匹配v-for中的in以及of 以item in sz为例 inMatch = [ 'item of sz', 'item', 'sz', index: 0, input: 'item of sz' ]*/
    const inMatch = exp.match(forAliasRE)
    /*匹配失败则在非生产环境中打印v-for的无效表达式*/
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid v-for expression: ${exp}`
      )
      return
    }
    /*在这里是sz*/
    el.for = inMatch[2].trim()
    /*item*/
    const alias = inMatch[1].trim()
    /*
      因为item可能是被括号包裹的，比如(item, index) in sz这样的形式，匹配出这些项
      例：(item, index)匹配得到结果
      [ '(item, index, l)',
      'item',
      ' index',
      l,
      index: 0,
      input: '(item, index, l);' ]
    */
    const iteratorMatch = alias.match(forIteratorRE)
    if (iteratorMatch) {
      el.alias = iteratorMatch[1].trim()
      el.iterator1 = iteratorMatch[2].trim()
      if (iteratorMatch[3]) {
        el.iterator2 = iteratorMatch[3].trim()
      }
    } else {
      el.alias = alias
    }
  }
}

/*匹配if属性，分别处理v-if、v-else以及v-else-if属性*/
function processIf (el) {
  /*取出v-if属性*/
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
  /*存在v-if属性*/
    el.if = exp
    /*在el的ifConditions属性汇总加入{exp, block}*/
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
  /*不存在v-if属性*/
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}

function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      children.pop()
    }
  }
}

/*在el的ifConditions属性汇总加入condition*/
function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

/*处理v-once属性，https://cn.vuejs.org/v2/api/#v-once*/
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

function processSlot (el) {
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    }
    if (el.tag === 'template') {
      el.slotScope = getAndRemoveAttr(el, 'scope')
    }
  }
}

function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name)
      if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind
        name = name.replace(bindRE, '')
        value = parseFilters(value)
        isProp = false
        if (modifiers) {
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel) {
            name = camelize(name)
          }
          if (modifiers.sync) {
            addHandler(
              el,
              `update:${camelize(name)}`,
              genAssignmentCode(value, `$event`)
            )
          }
        }
        if (isProp || platformMustUseProp(el.tag, el.attrsMap.type, name)) {
          addProp(el, name, value)
        } else {
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) { // v-on
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false, warn)
      } else { // normal directives
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        addDirective(el, name, rawName, value, arg, modifiers)
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const expression = parseText(value, delimiters)
        if (expression) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
    }
  }
}

/*检测该元素是否存在一个for循环中，将会沿着parent元素一级一级向上便利寻找是否处于一个for循环中。*/
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

/*判断是否是被禁止的标签（style标签或者script标签）*/
function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}
