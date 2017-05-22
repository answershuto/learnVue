前面已经讲过Vue数据绑定的原理了，现在从源码来看一下数据绑定在Vue中是如何实现的。

Vue在初始化组件数据时，在生命周期的init与created钩子函数之间实现了对data、props、computed、methods、events以及watch的处理。

## initData

这里来讲一下[initData](https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L107)，可以参考源码instance下的state.js文件，下面所有的中文注释都是我加的，英文注释是由大大加的，请不要忽略英文注释，英文注释都讲到了比较关键或者晦涩难懂的点。

加注释版的vue源码也可以直接通过[传送门](https://github.com/answershuto/learnVue/tree/master/vue-src)查看，这些是我在阅读Vue源码过程中加的注释，持续更新中。

```javascript
function initData (vm: Component) {

  /*得到data数据*/
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

  /*判断是否是对象*/
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  /*遍历data对象*/
  const keys = Object.keys(data)
  const props = vm.$options.props
  let i = keys.length

  //遍历data中的数据
  while (i--) {
    /*保证data中的key不与props中的key重复，props优先，如果有冲突会产生warning*/
    if (props && hasOwn(props, keys[i])) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${keys[i]}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(keys[i])) {
      /*判断是否是保留字段*/

      /*这里是我们前面讲过的代理，将data上面的属性代理到了vm实例上*/
      proxy(vm, `_data`, keys[i])
    }
  }

  // observe data
  /*从这里开始我们要observe了，开始对数据进行绑定，这里有尤大大的注释asRootData，这步作为根数据，下面会进行递归observe进行对深层对象的绑定。*/
  observe(data, true /* asRootData */)
}
```

## proxy

其实这段代码主要做了两件事，一是将_data上面的数据代理到vm上，另一件事通过observe将所有数据变成observable。
接下来看一下proxy代理。

```javascript
/*添加代理*/
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```

这里比较好理解，通过proxy函数将data上面的数据代理到vm上，这样就可以用app.text代替app._data.text了。

## observe

接下来是[observe](https://github.com/vuejs/vue/blob/dev/src/core/observer/index.js#L106)，这个函数定义在core文件下oberver的index.js文件中。

```javascript
/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
 /*
 尝试创建一个Observer实例（__ob__），如果成功创建Observer实例则返回新的Observer实例，如果已有Observer实例则返回现有的Observer实例。
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  /*判断是否是一个对象*/
  if (!isObject(value)) {
    return
  }
  let ob: Observer | void

  /*这里用__ob__这个属性来判断是否已经有Observer实例，如果没有Observer实例则会新建一个Observer实例并赋值给__ob__这个属性，如果已有Observer实例则直接返回该Observer实例*/
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (

    /*这里的判断是为了确保value是单纯的对象，而不是函数或者是Regexp等情况。*/
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {

    /*如果是根数据则计数，后面Observer中的observe的asRootData非true*/
    ob.vmCount++
  }
  return ob
}

```

## Observer

接下来看一下新建的[Observer](https://github.com/vuejs/vue/blob/dev/src/core/observer/index.js#L34)。Observer的作用就是遍历对象的所有属性将其进行双向绑定。

```javascript
/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0

    /* 
    将Observer实例绑定到data的__ob__属性上面去，之前说过observe的时候会先检测是否已经有__ob__对象存放Observer实例了，def方法定义可以参考https://github.com/vuejs/vue/blob/dev/src/core/util/lang.js#L16 
    */
    def(value, '__ob__', this)
    if (Array.isArray(value)) {

      /*如果是数组，将修改后可以截获响应的数组方法替换掉该数组的原型中的原生方法，达到监听数组数据变化响应的效果*/
      const augment = hasProto
        ? protoAugment  /*直接覆盖原型的方法来修改目标对象*/
        : copyAugment   /*定义（覆盖）目标对象或数组的某一个方法*/
      augment(value, arrayMethods, arrayKeys)

      /*如果是数组则需要遍历数组的每一个成员进行observe*/
      this.observeArray(value)
    } else {

      /*如果是对象则直接walk进行绑定*/
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)

    /*walk方法会遍历对象的每一个属性进行defineReactive绑定*/
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {

    /*数组需要便利每一个成员进行observe*/
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}
```

如果是修改一个数组的成员，该成员是一个对象，那之需要递归对数组的成员进行双向绑定即可。但是出现了一个问题，？如果我们进行pop、push等操作的时候，push进去的对象根本没有进行过双向绑定，更别说pop了，那么我们如何监听数组的这些变化呢？
Vue.js提供的方法是重写push、pop、shift、unshift、splice、sort、reverse这七个[数组方法](http://v1-cn.vuejs.org/guide/list.html#变异方法)。修改数组原型方法的代码可以参考[observer/array.js](https://github.com/vuejs/vue/blob/dev/src/core/observer/array.js)。

```javascript
/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

/*取得原生数组的原型*/
const arrayProto = Array.prototype
/*创建一个新的数组对象，修改该对象上的数组的七个方法，防止污染原生数组方法*/
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */
 /*这里重写了数组的这些方法，在保证不污染原生数组原型的情况下重写数组的这些方法，截获数组的成员发生的变化，执行原生数组操作的同时dep通知关联的所有观察者进行响应式处理*/
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  /*将数组的原生方法缓存起来，后面要调用*/
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator () {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    let i = arguments.length
    const args = new Array(i)
    while (i--) {
      args[i] = arguments[i]
    }
    /*调用原生的数组方法*/
    const result = original.apply(this, args)

    /*数组新插入的元素需要重新进行observe才能响应式*/
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
        inserted = args
        break
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
      
    // notify change
    /*dep通知所有注册的观察者进行响应式处理*/
    ob.dep.notify()
    return result
  })
})

```

在保证不污染不覆盖数组原生方法添加监听，主要做了两个操作，第一是通知所有注册的观察者进行响应式处理，第二是如果是添加成员的操作，需要对新成员进行observe。

## Watcher

[Watcher](https://github.com/vuejs/vue/blob/dev/src/core/observer/watcher.js#L24)是一个观察者对象。

```javascript

```

## Dep

来看看[Dep](https://github.com/vuejs/vue/blob/dev/src/core/observer/dep.js#L12)类。其实Dep就是一个发布者，可以订阅多个观察者。

```javascript
/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  /*添加一个观察者对象*/
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  /*移除一个观察者对象*/
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  /*依赖收集，当存在Dep.target的时候添加观察者对象*/
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  /*通知所有订阅者*/
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null
/*依赖收集完需要将Dep.target设为null，防止后面重复添加依赖。*/
```

## defineReactive

接下来是[defineReactive](https://github.com/vuejs/vue/blob/dev/src/core/observer/index.js#L131)。

```javascript
/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: Function
) {
  /*在闭包中定义一个dep对象*/
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  /*如果之前该对象已经预设了getter以及setter函数则将其取出来，新定义的getter/setter中会将其执行，保证不会覆盖之前已经定义的getter/setter。*/
  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set

  /*对象的子对象递归进行observe并返回子节点的Observer对象*/
  let childOb = observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {

      /*如果原本对象拥有getter方法则执行*/
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {

        /*进行依赖收集*/
        dep.depend()
        if (childOb) {

          /*子对象进行依赖收集，其实就是将同一个watcher观察者实例放进了两个depend中，一个是正在本身闭包中的depend，另一个是子元素的depend*/
          childOb.dep.depend()
        }
        if (Array.isArray(value)) {

          /*是数组则需要对每一个成员都进行依赖收集，如果数组的成员还是数组，则递归。*/
          dependArray(value)
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {

      /*通过getter方法获取当前值，与新值进行比较，一致则不需要执行下面的操作*/
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {

        /*如果原本对象拥有setter方法则执行setter*/
        setter.call(obj, newVal)
      } else {
        val = newVal
      }

      /*新的值需要重新进行observe，保证数据响应式*/
      childOb = observe(newVal)

      /*dep对象通知所有的观察者*/
      dep.notify()
    }
  })
}
```