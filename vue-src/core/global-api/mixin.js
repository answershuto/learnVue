/* @flow */

import { mergeOptions } from '../util/index'

/*初始化mixin*/
export function initMixin (Vue: GlobalAPI) {
    /*https://cn.vuejs.org/v2/api/#Vue-mixin*/
  Vue.mixin = function (mixin: Object) {
    /*mergeOptions合并optiuons*/
    this.options = mergeOptions(this.options, mixin)
  }
}
