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
