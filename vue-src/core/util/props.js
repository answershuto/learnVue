/* @flow */

import { hasOwn, isObject, isPlainObject, capitalize, hyphenate } from 'shared/util'
import { observe, observerState } from '../observer/index'
import { warn } from './debug'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

/*验证prop,不存在用默认值替换，类型为bool则声称true或false，当使用default中的默认值的时候会将默认值的副本进行observe*/
export function validateProp (
  key: string,/*prop的key值*/
  propOptions: Object,/*prop的参数，https://cn.vuejs.org/v2/guide/components.html#Prop-验证 */
  propsData: Object,/*props数据*/
  vm?: Component/*vm实例*/
): any {
  /*获取prop参数*/
  const prop = propOptions[key]
  /*该prop是否存在，也就是父组件是否正常传入，存在absent为false，反之为true*/
  const absent = !hasOwn(propsData, key)
  /*获得prop的value*/
  let value = propsData[key]
  // handle boolean props
  /*处理bool类型的属性*/
  if (isType(Boolean, prop.type)) {
    /*当父组件没有传入prop并且default中也不存在该prop时，赋值为false*/
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true
    }
  }
  // check default value
  /*当属性值不存在（即父组件没有传递下来）*/
  if (value === undefined) {
    /*获取属性的默认值*/
    value = getPropDefaultValue(vm, prop, key)

    // since the default value is a fresh copy,
    // make sure to observe it.
    /*由于默认值是一份新的拷贝副本，确保已经对它进行observe，有观察者观察它的变化。*/

    /*把之前的shouldConvert保存下来，当observe结束以后再设置回来*/
    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }
  if (process.env.NODE_ENV !== 'production') {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
 /*获取属性的默认值*/
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  /*没有默认值的时候直接返回undefined*/
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  /*非生产环境下发出警告，因为当前prop无默认值，当前对象的值非初始值。*/
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  /*以前的渲染的值如果不是undefined的，则返回上一次的默认值用以避免触发非必要的观察者*/
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  /*是funtion则改变它的上下文环境，vm。*/
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  if (!valid) {
    warn(
      'Invalid prop: type check failed for prop "' + name + '".' +
      ' Expected ' + expectedTypes.map(capitalize).join(', ') +
      ', got ' + Object.prototype.toString.call(value).slice(8, -1) + '.',
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    valid = typeof value === expectedType.toLowerCase()
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isType (type, fn) {
  if (!Array.isArray(fn)) {
    return getType(fn) === getType(type)
  }
  for (let i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  /* istanbul ignore next */
  return false
}
