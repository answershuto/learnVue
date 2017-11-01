import View from './components/view'
import Link from './components/link'

export let _Vue

/* Vue.use安装插件时候需要暴露的install方法 */
export function install (Vue) {
  
  /* 判断是否已安装过 */
  if (install.installed && _Vue === Vue) return
  install.installed = true

  /* 保存Vue实例 */
  _Vue = Vue

  /* 判断是否已定义 */
  const isDef = v => v !== undefined

  /* 通过registerRouteInstance方法注册router实例 */
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  /* 混淆进Vue实例，在boforeCreate与destroyed钩子上混淆 */
  Vue.mixin({
    /* boforeCreate钩子 */
    beforeCreate () {
      if (isDef(this.$options.router)) {
        /* 在option上面存在router则代表是根组件 */
        /* 保存跟组件vm */
        this._routerRoot = this
        /* 保存router */
        this._router = this.$options.router
        /* VueRouter对象的init方法 */
        this._router.init(this)
        /* Vue内部方法，为对象defineProperty上在变化时通知的属性 */
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        /* 非根组件则直接从父组件中获取 */
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      /* 通过registerRouteInstance方法注册router实例 */
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  /* 在Vue的prototype上面绑定$router，这样可以在任意Vue对象中使用this.$router访问，同时经过Object.defineProperty，访问this.$router即访问this._routerRoot._router */
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  /* 以上同理，访问this.$route即访问this._routerRoot._route */
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  /* 注册touter-view以及router-link组件 */
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  /* 该对象保存了两个option合并的规则 */
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
