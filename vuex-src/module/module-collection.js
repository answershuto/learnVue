import Module from './module'
import { assert, forEachValue } from '../util'

/*module收集类*/
export default class ModuleCollection {
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  /*获取父级module*/
  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  /*
    获取namespace，当namespaced为true的时候会返回'moduleName/name'
    默认情况下，模块内部的 action、mutation 和 getter 是注册在全局命名空间的——这样使得多个模块能够对同一 mutation 或 action 作出响应。
    如果希望你的模块更加自包含或提高可重用性，你可以通过添加 namespaced: true 的方式使其成为命名空间模块。
    当模块被注册后，它的所有 getter、action 及 mutation 都会自动根据模块注册的路径调整命名。
  */
  getNamespace (path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update (rawRootModule) {
    update([], this.root, rawRootModule)
  }

  /*注册*/
  register (path, rawModule, runtime = true) {
    if (process.env.NODE_ENV !== 'production') {
      assertRawModule(path, rawModule)
    }

    /*新建一个Module对象*/
    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
      /*path为空数组的代表跟节点*/
      this.root = newModule
    } else {
      /*获取父级module*/
      const parent = this.get(path.slice(0, -1))
      /*在父module中插入一个子module*/
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    /*递归注册module*/
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  /*注销*/
  unregister (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]
    if (!parent.getChild(key).runtime) return

    parent.removeChild(key)
  }
}

/* 更新 */
function update (path, targetModule, newModule) {
  if (process.env.NODE_ENV !== 'production') {
    assertRawModule(path, newModule)
  }

  // update target module
  /* 更新module */
  targetModule.update(newModule)

  // update nested modules
  /* 更新嵌套的module */
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

function assertRawModule (path, rawModule) {
  ['getters', 'actions', 'mutations'].forEach(key => {
    if (!rawModule[key]) return

    forEachValue(rawModule[key], (value, type) => {
      assert(
        typeof value === 'function',
        makeAssertionMessage(path, key, type, value)
      )
    })
  })
}

function makeAssertionMessage (path, key, type, value) {
  let buf = `${key} should be function but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`

  return buf
}
