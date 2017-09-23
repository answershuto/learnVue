export default function (Vue) {
  /*获取Vue版本，鉴别Vue1.0还是Vue2.0*/
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    /*通过mixin将vuexInit混淆到Vue实例的beforeCreate钩子中*/
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    /*将vuexInit放入_init中调用*/
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   */
   /*Vuex的init钩子，会存入每一个Vue实例等钩子列表*/
  function vuexInit () {
    const options = this.$options
    // store injection
    if (options.store) {
      /*存在store其实代表的就是Root节点，直接执行store（function时）或者使用store（非function）*/
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      /*子组件直接从父组件中获取$store，这样就保证了所有组件都公用了全局的同一份store*/
      this.$store = options.parent.$store
    }
  }
}
