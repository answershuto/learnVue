## 关于Vue.js

Vue.js是一款MVVM框架，上手快速简单易用，通过响应式在修改数据的时候更新视图。Vue.js的响应式原理依赖于[Object.defineProperty](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)，尤大大在[Vue.js文档](https://cn.vuejs.org/v2/guide/reactivity.html#如何追踪变化)中就已经提到过，这也是Vue.js不支持E8 以及更低版本浏览器的原因。Vue通过设定对象属性的 setter/getter 方法来监听数据的变化，通过getter进行依赖收集，而每个setter方法就是一个观察者，在数据变更的时候通知订阅者更新视图。


##将数据data变成可观察（observable）的

那么Vue是如何将所有data下面的所有属性变成可观察的（observable）呢？

```javascript
function observer(value) {
    Object.keys(value).forEach((key) => defineReactive(value, key, value[key] , cb))
}

function defineReactive (obj, key, val, cb) {
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: ()=>{
            /*....依赖收集等....*/
        },
        set:newVal=> {
            cb();/*订阅者收到消息的回调*/
        }
    })
}

class Vue {
    constructor(options) {
        this._data = options.data;
        observer(this._data, options.render)
    }
}

var demo = new Vue({
    el: '#app',
    data: {
        text: 'text',
        text2: 'text2'
    },
    render(){
        console.log("render");
    }
})
```

