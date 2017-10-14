## Vuex

我们在使用Vue.js开发复杂的应用时，经常会遇到多个组件共享同一个状态，亦或是多个组件会去更新同一个状态，在应用代码量较少的时候，我们可以组件间通信去维护修改数据，但是当应用逐渐庞大以后，代码就会变得难以维护。

Vuex是一个专门为Vue.js框架设计的、用于对Vue.js应用程序进行状态管理的库，它借鉴了Flux、redux的基本思想，将共享的数据抽离到全局，以一个单例存放，同时利用Vue.js的响应式机制来进行高效的状态管理与更新。具体使用方法及API可以参考[Vuex的官网](https://vuex.vuejs.org/zh-cn/intro.html)。

先来看一下这张Vuex的数据流程图，熟悉Vuex使用的同学应该已经有所了解。

![](https://vuex.vuejs.org/zh-cn/images/vuex.png)

## 安装

使用过Vuex的朋友一定知道，Vuex的安装十分简单，只需要提供一个store，然后执行下面两句代码即完成的Vuex的引入。

```javascript
Vue.use(Vuex);

/*将store放入Vue创建时的option中*/
new Vue({
    el: '#app',
    store
});
```

那么问题来了，Vuex是怎样把store注入到Vue实例中去的呢？

Vue.js提供了[Vue.use](https://cn.vuejs.org/v2/api/#Vue-use)方法用来给Vue.js安装插件，内部通过调用插件的install方法(当插件是一个对象的时候)来进行插件的安装。

我们来看一下Vuex的install实现。

```javascript
/*暴露给外部的插件install方法，供Vue.use调用安装插件*/
export function install (_Vue) {
  if (Vue) {
    /*避免重复安装（Vue.use内部也会检测一次是否重复安装同一个插件）*/
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  /*保存Vue，同时用于检测是否重复安装*/
  Vue = _Vue
  /*将vuexInit混淆进Vue的beforeCreate(Vue2.0)或_init方法(Vue1.0)*/
  applyMixin(Vue)
}
```

这段install代码做了两件事情，一件是防止Vuex被重复安装，另一件是执行applyMixin，目的是执行vuexInit方法初始化Vuex。Vuex针对Vue1.0与2.0分别进行了不同的处理，如果是Vue1.0，Vuex会将vuexInit方法放入Vue的_init方法中，而对于Vue2.0，则会将vuexinit混淆进Vue的beforeCreacte钩子中。来看一下vuexInit的代码。

```javascript
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
```

vuexInit会尝试从options中获取store，如果当前组件是根组件（Root节点），则options中会存在store，直接获取赋值给$store即可。如果当前组件非根组件，则通过options中的parent获取父组件的$store引用。这样一来，所有的组件都获取到了同一份内存地址的Store实例，于是我们可以在每一个组件中通过this.$store愉快地访问全局的Store实例了。

那么，什么是Store实例？

## Store

我们传入到根组件到store，就是Store实例，用Vuex提供到Store方法构造。

```javascript
export default new Vuex.Store({
    strict: true,
    modules: {
        moduleA,
        moduleB
    }
});
```

我们来看一下Store的实现。首先是构造函数。

```javascript
constructor (options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    /*
      在浏览器环境下，如果插件还未安装（!Vue即判断是否未安装），则它会自动安装。
      它允许用户在某些情况下避免自动安装。
    */
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    if (process.env.NODE_ENV !== 'production') {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `Store must be called with the new operator.`)
    }

    const {
      /*一个数组，包含应用在 store 上的插件方法。这些插件直接接收 store 作为唯一参数，可以监听 mutation（用于外部地数据持久化、记录或调试）或者提交 mutation （用于内部数据，例如 websocket 或 某些观察者）*/
      plugins = [],
      /*使 Vuex store 进入严格模式，在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误。*/
      strict = false
    } = options

    /*从option中取出state，如果state是function则执行，最终得到一个对象*/
    let {
      state = {}
    } = options
    if (typeof state === 'function') {
      state = state()
    }

    // store internal state
    /* 用来判断严格模式下是否是用mutation修改state的 */
    this._committing = false
    /* 存放action */
    this._actions = Object.create(null)
    /* 存放mutation */
    this._mutations = Object.create(null)
    /* 存放getter */
    this._wrappedGetters = Object.create(null)
    /* module收集器 */
    this._modules = new ModuleCollection(options)
    /* 根据namespace存放module */
    this._modulesNamespaceMap = Object.create(null)
    /* 存放订阅者 */
    this._subscribers = []
    /* 用以实现Watch的Vue实例 */
    this._watcherVM = new Vue()

    // bind commit and dispatch to self
    /*将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm*/
    const store = this
    const { dispatch, commit } = this
    /* 为dispatch与commit绑定this（Store实例本身） */
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    /*严格模式(使 Vuex store 进入严格模式，在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误)*/
    this.strict = strict

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    /*初始化根module，这也同时递归注册了所有子modle，收集所有module的getter到_wrappedGetters中去，this._modules.root代表根module才独有保存的Module对象*/
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    /* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
    resetStoreVM(this, state)

    // apply plugins
    /* 调用插件 */
    plugins.forEach(plugin => plugin(this))

    /* devtool插件 */
    if (Vue.config.devtools) {
      devtoolPlugin(this)
    }
  }
```

Store的构造类除了初始化一些内部变量以外，主要执行了installModule（初始化module）以及resetStoreVM（通过VM使store“响应式”）。

### installModule

installModule的作用主要是用为module加上namespace名字空间（如果有）后，注册mutation、action以及getter，同时递归安装所有子module。

```javascript
/*初始化module*/
function installModule (store, rootState, path, module, hot) {
  /* 是否是根module */
  const isRoot = !path.length
  /* 获取module的namespace */
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  /* 如果有namespace则在_modulesNamespaceMap中注册 */
  if (module.namespaced) {
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  if (!isRoot && !hot) {
    /* 获取父级的state */
    const parentState = getNestedState(rootState, path.slice(0, -1))
    /* module的name */
    const moduleName = path[path.length - 1]
    store.`_withCommit`(() => {
      /* 将子module设置称响应式的 */
      Vue.set(parentState, moduleName, module.state)
    })
  }

  const local = module.context = makeLocalContext(store, namespace, path)

  /* 遍历注册mutation */
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  /* 遍历注册action */
  module.forEachAction((action, key) => {
    const namespacedType = namespace + key
    registerAction(store, namespacedType, action, local)
  })

  /* 遍历注册getter */
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  /* 递归安装mudule */
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}
```
