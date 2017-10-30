## Vuex

我们在使用Vue.js开发复杂的应用时，经常会遇到多个组件共享同一个状态，亦或是多个组件会去更新同一个状态，在应用代码量较少的时候，我们可以组件间通信去维护修改数据，或者是通过事件总线来进行数据的传递以及修改。但是当应用逐渐庞大以后，代码就会变得难以维护，从父组件开始通过prop传递多层嵌套的数据由于层级过深而显得异常脆弱，而事件总线也会因为组件的增多、代码量的增大而显得交互错综复杂，难以捋清其中的传递关系。

那么为什么我们不能将数据层与组件层抽离开来呢？把数据层放到全局形成一个单一的Store，组件层变得更薄，专门用来进行数据的展示及操作。所有数据的变更都需要经过全局的Store来进行，形成一个单向数据流，使数据变化变得“可预测”。

Vuex是一个专门为Vue.js框架设计的、用于对Vue.js应用程序进行状态管理的库，它借鉴了Flux、redux的基本思想，将共享的数据抽离到全局，以一个单例存放，同时利用Vue.js的响应式机制来进行高效的状态管理与更新。正是因为Vuex使用了Vue.js内部的“响应式机制”，所以Vuex是一个专门为Vue.js设计并与之高度契合的框架（优点是更加简洁高效，缺点是只能跟Vue.js搭配使用）。具体使用方法及API可以参考[Vuex的官网](https://vuex.vuejs.org/zh-cn/intro.html)。

先来看一下这张Vuex的数据流程图，熟悉Vuex使用的同学应该已经有所了解。

![](https://vuex.vuejs.org/zh-cn/images/vuex.png)

Vuex实现了一个单向数据流，在全局拥有一个State存放数据，所有修改State的操作必须通过Mutation进行，Mutation的同时提供了订阅者模式供外部插件调用获取State数据的更新。所有异步接口需要走Action，常见于调用后端接口异步获取更新数据，而Action也是无法直接修改State的，还是需要通过Mutation来修改State的数据。最后，根据State的变化，渲染到视图上。Vuex运行依赖Vue内部数据双向绑定机制，需要new一个Vue对象来实现“响应式化”，所以Vuex是一个专门为Vue.js设计的状态管理库。

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

### resetStoreVM

在说resetStoreVM之前，先来看一个小demo。

```javascript
let globalData = {
    d: 'hello world'
};
new Vue({
    data () {
        return {
            $$state: {
                globalData
            }
        }
    }
});

/* modify */
setTimeout(() => {
    globalData.d = 'hi~';
}, 1000);

Vue.prototype.globalData = globalData;

/* 任意模板中 */
<div>{{globalData.d}}</div>
```

上述代码在全局有一个globalData，它被传入一个Vue对象的data中，之后在任意Vue模板中对该变量进行展示，因为此时globalData已经在Vue的prototype上了所以直接通过this.prototype访问，也就是在模板中的{{prototype.d}}。此时，setTimeout在1s之后将globalData.d进行修改，我们发现模板中的globalData.d发生了变化。其实上述部分就是Vuex依赖Vue核心实现数据的“响应式化”。

不熟悉Vue.js响应式原理的同学可以通过笔者另一篇文章[响应式原理](https://github.com/answershuto/learnVue/blob/master/docs/%E5%93%8D%E5%BA%94%E5%BC%8F%E5%8E%9F%E7%90%86.MarkDown)了解Vue.js是如何进行数据双向绑定的。

接着来看代码。

```javascript
/* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
function resetStoreVM (store, state, hot) {
  /* 存放之前的vm对象 */
  const oldVm = store._vm 

  // bind store public getters
  store.getters = {}
  const wrappedGetters = store._wrappedGetters
  const computed = {}

  /* 通过Object.defineProperty为每一个getter方法设置get方法，比如获取this.$store.getters.test的时候获取的是store._vm.test，也就是Vue对象的computed属性 */
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    computed[key] = () => fn(store)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  /* Vue.config.silent暂时设置为true的目的是在new一个Vue实例的过程中不会报出一切警告 */
  Vue.config.silent = true
  /*  这里new了一个Vue对象，运用Vue内部的响应式实现注册state以及computed*/
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  Vue.config.silent = silent

  // enable strict mode for new vm
  /* 使能严格模式，保证修改store只能通过mutation */
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldVm) {
    /* 解除旧vm的state的引用，以及销毁旧的Vue对象 */
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}
```

resetStoreVM首先会遍历wrappedGetters，使用Object.defineProperty方法为每一个getter绑定上get方法，这样我们就可以在组件里访问this.$store.getter.test就等同于访问store._vm.test。

```javascript
forEachValue(wrappedGetters, (fn, key) => {
  // use computed to leverage its lazy-caching mechanism
  computed[key] = () => fn(store)
  Object.defineProperty(store.getters, key, {
    get: () => store._vm[key],
    enumerable: true // for local getters
  })
})
```

之后Vuex采用了new一个Vue对象来实现数据的“响应式化”，运用Vue.js内部提供的数据双向绑定功能来实现store的数据与视图的同步更新。

```javascript
store._vm = new Vue({
  data: {
    $$state: state
  },
  computed
})
```

这时候我们访问store._vm.test也就访问了Vue实例中的属性。

这两步执行完以后，我们就可以通过this.$store.getter.test访问vm中的test属性了。

### 严格模式

Vuex的Store构造类的option有一个strict的参数，可以控制Vuex执行严格模式，严格模式下，所有修改state的操作必须通过mutation实现，否则会抛出错误。

```javascript
/* 使能严格模式 */
function enableStrictMode (store) {
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
      /* 检测store中的_committing的值，如果是true代表不是通过mutation的方法修改的 */
      assert(store._committing, `Do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}
```

首先，在严格模式下，Vuex会利用vm的$watch方法来观察$$state，也就是Store的state，在它被修改的时候进入回调。我们发现，回调中只有一句话，用assert断言来检测store._committing，当store._committing为false的时候会触发断言，抛出异常。

我们发现，Store的commit方法中，执行mutation的语句是这样的。

```javascript
this._withCommit(() => {
  entry.forEach(function commitIterator (handler) {
    handler(payload)
  })
})
```

再来看看_withCommit的实现。

```javascript
_withCommit (fn) {
  /* 调用withCommit修改state的值时会将store的committing值置为true，内部会有断言检查该值，在严格模式下只允许使用mutation来修改store中的值，而不允许直接修改store的数值 */
  const committing = this._committing
  this._committing = true
  fn()
  this._committing = committing
}
```

我们发现，通过commit（mutation）修改state数据的时候，会再调用mutation方法之前将committing置为true，接下来再通过mutation函数修改state中的数据，这时候触发$watch中的回调断言committing是不会抛出异常的（此时committing为true）。而当我们直接修改state的数据时，触发$watch的回调执行断言，这时committing为false，则会抛出异常。这就是Vuex的严格模式的实现。

接下来我们来看看Store提供的一些API。

### commit（[mutation](https://vuex.vuejs.org/zh-cn/mutations.html)）

```javascript
/* 调用mutation的commit方法 */
commit (_type, _payload, _options) {
  // check object-style commit
  /* 校验参数 */
  const {
    type,
    payload,
    options
  } = unifyObjectStyle(_type, _payload, _options)

  const mutation = { type, payload }
  /* 取出type对应的mutation的方法 */
  const entry = this._mutations[type]
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] unknown mutation type: ${type}`)
    }
    return
  }
  /* 执行mutation中的所有方法 */
  this._withCommit(() => {
    entry.forEach(function commitIterator (handler) {
      handler(payload)
    })
  })
  /* 通知所有订阅者 */
  this._subscribers.forEach(sub => sub(mutation, this.state))

  if (
    process.env.NODE_ENV !== 'production' &&
    options && options.silent
  ) {
    console.warn(
      `[vuex] mutation type: ${type}. Silent option has been removed. ` +
      'Use the filter functionality in the vue-devtools'
    )
  }
}
```

commit方法会根据type找到并调用_mutations中的所有type对应的mutation方法，所以当没有namespace的时候，commit方法会触发所有module中的mutation方法。再执行完所有的mutation之后会执行_subscribers中的所有订阅者。我们来看一下_subscribers是什么。

Store给外部提供了一个subscribe方法，用以注册一个订阅函数，会push到Store实例的_subscribers中，同时返回一个从_subscribers中注销该订阅者的方法。

```javascript
/* 注册一个订阅函数，返回取消订阅的函数 */
subscribe (fn) {
  const subs = this._subscribers
  if (subs.indexOf(fn) < 0) {
    subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}
```

在commit结束以后则会调用这些_subscribers中的订阅者，这个订阅者模式提供给外部一个监视state变化的可能。state通过mutation改变时，可以有效补获这些变化。

### dispatch（[action](https://vuex.vuejs.org/zh-cn/actions.html)）

来看一下dispatch的实现。

```javascript
/* 调用action的dispatch方法 */
dispatch (_type, _payload) {
  // check object-style dispatch
  const {
    type,
    payload
  } = unifyObjectStyle(_type, _payload)

  /* actions中取出type对应的ation */
  const entry = this._actions[type]
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] unknown action type: ${type}`)
    }
    return
  }

  /* 是数组则包装Promise形成一个新的Promise，只有一个则直接返回第0个 */
  return entry.length > 1
    ? Promise.all(entry.map(handler => handler(payload)))
    : entry[0](payload)
}
```

以及registerAction时候做的事情。

```javascript
/* 遍历注册action */
function registerAction (store, type, handler, local) {
  /* 取出type对应的action */
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler (payload, cb) {
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload, cb)
    /* 判断是否是Promise */
    if (!isPromise(res)) {
      /* 不是Promise对象的时候转化称Promise对象 */
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      /* 存在devtool插件的时候触发vuex的error给devtool */
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}
```

因为registerAction的时候将push进_actions的action进行了一层封装（wrappedActionHandler），所以我们在进行dispatch的第一个参数中获取state、commit等方法。之后，执行结果res会被进行判断是否是Promise，不是则会进行一层封装，将其转化成Promise对象。dispatch时则从_actions中取出，只有一个的时候直接返回，否则用Promise.all处理再返回。

### watch

```javascript
/* 观察一个getter方法 */
watch (getter, cb, options) {
  if (process.env.NODE_ENV !== 'production') {
    assert(typeof getter === 'function', `store.watch only accepts a function.`)
  }
  return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
}
```

熟悉Vue的朋友应该很熟悉watch这个方法。这里采用了比较巧妙的设计，_watcherVM是一个Vue的实例，所以watch就可以直接采用了Vue内部的watch特性提供了一种观察数据getter变动的方法。

### registerModule

```javascript
/* 注册一个动态module，当业务进行异步加载的时候，可以通过该接口进行注册动态module */
registerModule (path, rawModule) {
  /* 转化称Array */
  if (typeof path === 'string') path = [path]

  if (process.env.NODE_ENV !== 'production') {
    assert(Array.isArray(path), `module path must be a string or an Array.`)
    assert(path.length > 0, 'cannot register the root module by using registerModule.')
  }

  /*注册*/
  this._modules.register(path, rawModule)
  /*初始化module*/
  installModule(this, this.state, path, this._modules.get(path))
  // reset store to update getters...
  /* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
  resetStoreVM(this, this.state)
}
```

registerModule用以注册一个动态模块，也就是在store创建以后再注册模块的时候用该接口。内部实现实际上也只有installModule与resetStoreVM两个步骤，前面已经讲过，这里不再累述。

### unregisterModule

```javascript
 /* 注销一个动态module */
unregisterModule (path) {
  /* 转化称Array */
  if (typeof path === 'string') path = [path]

  if (process.env.NODE_ENV !== 'production') {
    assert(Array.isArray(path), `module path must be a string or an Array.`)
  }

  /*注销*/
  this._modules.unregister(path)
  this._withCommit(() => {
    /* 获取父级的state */
    const parentState = getNestedState(this.state, path.slice(0, -1))
    /* 从父级中删除 */
    Vue.delete(parentState, path[path.length - 1])
  })
  /* 重制store */
  resetStore(this)
}
```

同样，与registerModule对应的方法unregisterModule，动态注销模块。实现方法是先从state中删除模块，然后用resetStore来重制store。

### resetStore

```javascript
/* 重制store */
function resetStore (store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}
```

这里的resetStore其实也就是将store中的_actions等进行初始化以后，重新执行installModule与resetStoreVM来初始化module以及用Vue特性使其“响应式化”，这跟构造函数中的是一致的。

## 插件

Vue提供了一个非常好用的插件[Vue.js devtools](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)

```javascript
/* 从window对象的__VUE_DEVTOOLS_GLOBAL_HOOK__中获取devtool插件 */
const devtoolHook =
  typeof window !== 'undefined' &&
  window.__VUE_DEVTOOLS_GLOBAL_HOOK__

export default function devtoolPlugin (store) {
  if (!devtoolHook) return

  /* devtoll插件实例存储在store的_devtoolHook上 */
  store._devtoolHook = devtoolHook

  /* 出发vuex的初始化事件，并将store的引用地址传给deltool插件，使插件获取store的实例 */
  devtoolHook.emit('vuex:init', store)

  /* 监听travel-to-state事件 */
  devtoolHook.on('vuex:travel-to-state', targetState => {
    /* 重制state */
    store.replaceState(targetState)
  })

  /* 订阅store的变化 */
  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
```

如果已经安装了该插件，则会在windows对象上暴露一个__VUE_DEVTOOLS_GLOBAL_HOOK__。devtoolHook用在初始化的时候会触发“vuex:init”事件通知插件，然后通过on方法监听“vuex:travel-to-state”事件来重置state。最后通过Store的subscribe方法来添加一个订阅者，在触发commit方法修改mutation数据以后，该订阅者会被通知，从而触发“vuex:mutation”事件。

## 最后

Vuex是一个非常优秀的库，代码量不多且结构清晰，非常适合研究学习其内部实现。最近的一系列源码阅读也使我自己受益匪浅，写这篇文章也希望可以帮助到更多想要学习探索Vuex内部实现原理的同学。