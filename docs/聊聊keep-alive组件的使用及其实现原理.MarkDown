## keep-alive

keep-alive是Vue.js的一个内置组件。它能够不活动的组件实例保存在内存中，而不是直接将其销毁，它是一个抽象组件，不会被渲染到真实DOM中，也不会出现在父组件链中。

它提供了include与exclude两个属性，允许组件有条件地进行缓存。

具体内容可以参考[官网](https://cn.vuejs.org/v2/api/#keep-alive)。

## 使用

### 用法

```html
<keep-alive>
    <component></component>
</keep-alive>
```

这里的component组件会被缓存起来。

### 举个栗子

![](https://img3.duitang.com/uploads/item/201604/22/20160422030517_QwZMm.thumb.700_0.jpeg)

```html
<keep-alive>
    <coma v-if="test"></coma>
    <comb v-else="test"></comb>
</keep-alive>
<button @click="test=handleClick">请点击</button>
```

```javascript
export default {
    data () {
        return {
            test: true
        }
    },
    methods: {
        handleClick () {
            this.test = !this.test;
        }
    }
}
```

在点击button时候，coma与comb两个组件会发生切换，但是这时候这两个组件的状态会被缓存起来，比如说coma与comb组件中都有一个input标签，那么input标签中的内容不会因为组件的切换而消失。

### props

keep-alive组件提供了include与exclude两个属性来允许组件有条件地进行缓存，二者都可以用逗号分隔字符串、正则表达式或一个数组来表示。

```html
<keep-alive include="a">
  <component></component>
</keep-alive>
```

将缓存name为a的组件。

```html
<keep-alive exclude="a">
  <component></component>
</keep-alive>
```

name为a的组件将不会被缓存。

### 生命钩子

keep-alive提供了两个生命钩子，分别是activated与deactivated。

因为keep-alive会将组件保存在内存中，并不会销毁以及重新创建，所以不会重新调用组件的created等方法，需要用activated与deactivated这两个生命钩子来得知当前组件是否处于活动状态。

## 深入keep-alive组件实现

说完了keep-alive组件的使用，我们从源码角度看一下keep-alive组件究竟是如何实现组件的缓存的呢？

### render

我们从keep-alive组件的render函数看起。

```javascript
render () {
    /* 得到slot插槽中的第一个组件 */
    const vnode: VNode = getFirstComponentChild(this.$slots.default)

    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
        // check pattern
        /* 获取组件名称，优先获取组件的name字段，否则是组件的tag */
        const name: ?string = getComponentName(componentOptions)
        /* name不在inlcude中或者在exlude中则直接返回vnode（没有取缓存） */
        if (name && (
        (this.include && !matches(this.include, name)) ||
        (this.exclude && matches(this.exclude, name))
        )) {
            return vnode
        }
        const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
        /* 如果已经做过缓存了则直接从缓存中获取组件实例给vnode，还未缓存过则进行缓存 */
        if (this.cache[key]) {
            vnode.componentInstance = this.cache[key].componentInstance
        } else {
            this.cache[key] = vnode
        }
        /* keepAlive标记位 */
        vnode.data.keepAlive = true
    }
    return vnode
}
```

首先通过getFirstComponentChild获取第一个子组件。
