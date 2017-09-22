/* @flow */

import { toArray } from '../util/index'

/*初始化use*/
export function initUse (Vue: GlobalAPI) {
  /*https://cn.vuejs.org/v2/api/#Vue-use*/
  Vue.use = function (plugin: Function | Object) {
    /* istanbul ignore if */
    /*标识位检测该插件是否已经被安装*/
    if (plugin.installed) {
      return
    }
    // additional parameters
    const args = toArray(arguments, 1)
    /*a*/
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      /*install执行插件安装*/
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    plugin.installed = true
    return this
  }
}
