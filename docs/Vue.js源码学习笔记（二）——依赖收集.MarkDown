## 为什么要依赖收集

先看下面这段代码

```javascript
new Vue({
    template: 
        `<div>
            <span>text1:</span> {{text1}}
            <span>text2:</span> {{text2}}
        <div>`,
    data: {
        text1: 'text1',
        text2: 'text2',
        text3: 'text3'
    }
});
```

按照之前《Vue.js源码学习笔记（一）——响应式原理》中的方法进行绑定则会出现一个问题——text3在实际模板中并没有被用到，然而当text3的数据被修改的时候（this.text3 = 'test'）的时候，同样会触发text3的setter导致重新执行渲染，这显然不正确。

## 先说说Dep

当对data上的对象进行修改值的时候会触发它的setter，那么取值的时候自然就会触发getter事件，所以我们只要在最开始进行一次render，那么所有被渲染所依赖的data中的数据就会被getter收集到Dep的subs中去。在对data中的数据进行修改的时候setter只会触发Dep的subs的函数。

定义一个依赖收集类Dep。

```javascript
class Dep () {
    constructor () {
        this.subs = [];
    }

    addSub (sub: Watcher) {
        this.subs.push(sub)
    }

    removeSub (sub: Watcher) {
        remove(this.subs, sub)
    }

    notify () {
        // stabilize the subscriber list first
        const subs = this.subs.slice()
        for (let i = 0, l = subs.length; i < l; i++) {
            subs[i].update()
        }
    }
}
```

## Watcher

观察者，当依赖收集的时候回addSub到sub中，在修改data中数据的时候会触发Watcher的notify，从而回调渲染函数。

```javascript
class Watcher () {
    constructor (vm, expOrFn, cb, options) {
        this.cb = cb;
        this.vm = vm;

        /*在这里将观察者本身赋值给全局的target，只有呗target标记过的才会进行依赖收集*/
        Dep.target = this;
    }

    update () {
        this.cb.call(this.vm);
    }
}
```

## 开始依赖收集

```javascript
function defineReactive (obj, key, val, cb) {
    const dep = new Dep();

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: ()=>{
            if (Dep.target) {
                dep.addSub(Dep.target);/*Watcher对象存在全局的Dep.target中*/
            }
        },
        set:newVal=> {
            /*只有之前addSub中的函数才会触发*/
            dep.update();
        }
    })
}
```