/*用来标记是否是服务端渲染*/
export const SSR_ATTR = 'data-server-rendered'

/*选项／资源集合*/
export const ASSET_TYPES = [
  'component',
  'directive',
  'filter'
]

/*钩子函数集合*/
export const LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated'
]
