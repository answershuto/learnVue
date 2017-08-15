/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  /*
    每个构造函数实例（包括Vue本身）都会有一个唯一的cid
    它为我们能够创造继承创建自构造函数并进行缓存创造了可能
  */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
   /*
   使用基础 Vue 构造器，创建一个“子类”。
   其实就是扩展了基础构造器，形成了一个可复用的有指定选项功能的子构造器。
   参数是一个包含组件option的对象。  https://cn.vuejs.org/v2/api/#Vue-extend-options
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    /*父类的构造*/
    const Super = this
    /*父类的cid*/
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    /*如果构造函数中已经存在了该cid，则代表已经extend过了，直接返回*/
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      /*name只能包含字母与连字符*/
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    /*
      Sub构造函数其实就一个_init方法，这跟Vue的构造方法是一致的，在_init中处理各种数据初始化、生命周期等。
      因为Sub作为一个Vue的扩展构造器，所以基础的功能还是需要保持一致，跟Vue构造器一样在构造函数中初始化_init。
    */
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    /*继承父类*/
    Sub.prototype = Object.create(Super.prototype)
    /*构造函数*/
    Sub.prototype.constructor = Sub
    /*创建一个新的cid*/
    Sub.cid = cid++
    /*将父组件的option与子组件的合并到一起(Vue有一个cid为0的基类，即Vue本身，会将一些默认初始化的option何入)*/
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    /*es6语法，super为父类构造*/
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    /*在扩展时，我们将计算属性以及props通过代理绑定在Vue实例上（也就是vm），这也避免了Object.defineProperty被每一个实例调用*/
    if (Sub.options.props) {
      /*初始化props，将option中的_props代理到vm上*/
      initProps(Sub)
    }
    if (Sub.options.computed) {
      /*处理计算属性，给计算属性设置defineProperty并绑定在vm上*/
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    /*加入extend、mixin以及use方法，允许将来继续为该组件提供扩展、混合或者插件*/
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    /*使得Sub也会拥有父类的私有选项（directives、filters、components）*/
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    /*把组件自身也加入components中，为递归自身提供可能（递归组件也会查找components是否存在当前组件，也就是自身）*/
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    /*保存一个父类的options，此后我们可以用来检测父类的options是否已经被更新*/
    Sub.superOptions = Super.options，
    /*extendOptions存储起来*/
    Sub.extendOptions = extendOptions
    /*保存一份option，extend的作用是将Sub.options中的所有属性放入{}中*/
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    /*缓存构造函数（用cid），防止重复extend*/
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/*初始化props，将option中的_props代理到vm上*/
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

/*处理计算属性，给计算属性设置defineProperty并绑定在vm上*/
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
