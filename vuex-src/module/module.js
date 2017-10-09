import { forEachValue } from '../util'

/*Module构造类*/
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime
    this._children = Object.create(null)
    /*保存module*/
    this._rawModule = rawModule
    /*保存modele的state*/
    const rawState = rawModule.state
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  /* 获取namespace */
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  /*插入一个子module，存入_children中*/
  addChild (key, module) {
    this._children[key] = module
  }

  /*移除一个子module*/
  removeChild (key) {
    delete this._children[key]
  }

  /*根据key获取子module*/
  getChild (key) {
    return this._children[key]
  }

  /* 更新module */
  update (rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  /* 遍历child  */
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  /* 遍历getter */
  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  /* 遍历action */
  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  /* 遍历matation */
  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
