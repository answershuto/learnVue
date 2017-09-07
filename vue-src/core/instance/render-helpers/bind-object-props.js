/* @flow */

import config from 'core/config'
import { isObject, warn, toObject } from 'core/util/index'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 */
 /*合并v-bind指令到VNode中*/
export function bindObjectProps (
  data: any,
  tag: string,
  value: any,
  asProp?: boolean
): VNodeData {
  if (value) {
    if (!isObject(value)) {
      /*v-bind必须提供一个Object或者Array作为参数*/
      process.env.NODE_ENV !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      )
    } else {
      if (Array.isArray(value)) {
        /*合并Array数组中的每一个对象到一个新的Object中*/
        value = toObject(value)
      }
      let hash
      for (const key in value) {
        if (key === 'class' || key === 'style') {
          hash = data
        } else {
          const type = data.attrs && data.attrs.type
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {})
        }
        if (!(key in hash)) {
          hash[key] = value[key]
        }
      }
    }
  }
  return data
}
