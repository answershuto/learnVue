## 关于Vue.js

Vue.js是一款MVVM框架，上手快速简单易用，通过响应式在修改数据的时候更新视图。Vue.js的响应式原理依赖于[Object.defineProperty](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)，尤大大在[Vue.js文档](https://cn.vuejs.org/v2/guide/reactivity.html#如何追踪变化)中就已经提到过，这也是Vue.js不支持IE8 以及更低版本浏览器的原因。Vue通过设定对象属性的 setter/getter 方法来监听数据的变化，通过getter进行依赖收集，而每个setter方法就是一个观察者，在数据变更的时候通知订阅者更新视图。


## 将数据data变成可观察（observable）的

那么Vue是如何将所有data下面的所有属性变成可观察的（observable）呢？

```javascript
function observe(value, cb) {
    Object.keys(value).forEach((key) => defineReactive(value, key, value[key] , cb))
}

function defineReactive (obj, key, val, cb) {
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: ()=>{
            /*....依赖收集等....*/
            /*Github:https://github.com/answershuto*/
            return val
        },
        set:newVal=> {
            val = newVal;
            cb();/*订阅者收到消息的回调*/
        }
    })
}

class Vue {
    constructor(options) {
        this._data = options.data;
        observe(this._data, options.render)
    }
}

let app = new Vue({
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

为了便于理解，首先考虑一种最简单的情况，不考虑数组等情况，代码如上所示。在[initData](https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L107)中会调用[observe](https://github.com/vuejs/vue/blob/dev/src/core/observer/index.js#L106)这个函数将Vue的数据设置成observable的。当_data数据发生改变的时候就会触发set，对订阅者进行回调（在这里是render）。

那么问题来了，需要对app._data.text操作才会触发set。为了偷懒，我们需要一种方便的方法通过app.text直接设置就能触发set对视图进行重绘。那么就需要用到代理。

## 代理

我们可以在Vue的构造函数constructor中为data执行一个代理[proxy](https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L33)。这样我们就把data上面的属性代理到了vm实例上。

```javascript
_proxy.call(this, options.data);/*构造函数中*/

/*代理*/
function _proxy (data) {
    const that = this;
    Object.keys(data).forEach(key => {
        Object.defineProperty(that, key, {
            configurable: true,
            enumerable: true,
            get: function proxyGetter () {
                return that._data[key];
            },
            set: function proxySetter (val) {
                that._data[key] = val;
            }
        })
    });
}
```

我们就可以用app.text代替app._data.text了。
