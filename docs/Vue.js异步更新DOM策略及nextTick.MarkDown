## 操作DOM

在使用vue.js的时候，有时候因为一些特定的业务场景，不得不去操作DOM，比如这样：

```html
<template>
  <div>
    <div ref="test">{{test}}</div>
    <button @click="handleClick">tet</button>
  </div>
</template>

```

```javascript
export default {
    data () {
        return {
            test: 'begin'
        };
    },
    methods () {
        handleClick () {
            this.test = 'end';
            console.log(this.$refs.test.innerText);//打印“begin”
        }
    }
}
```

打印的结果是begin，为什么我们明明已经将test设置成了“end”，获取真实DOM节点的innerText却没有得到我们预期中的“end”，而是得到之前的值“begin”呢？

## Watch队列

带着疑问，我们找到了Vue.js源码的Watch实现。当某个响应式数据发生变化的时候，它的setter函数会通知闭包中的Dep，Dep则会调用它管理的所有Watch对象。触发Watch对象的update实现。我们来看一下update的实现。

```javascript
update () {
    /* istanbul ignore else */
    if (this.lazy) {
        this.dirty = true
    } else if (this.sync) {
        /*同步则执行run直接渲染视图*/
        this.run()
    } else {
        /*异步推送到观察者队列中，下一个tick时调用。*/
        queueWatcher(this)
    }
}
```

我们发现当异步执行update的时候，会调用queueWatcher函数。

```javascript
 /*将一个观察者对象push进观察者队列，在队列中已经存在相同的id则该观察者对象将被跳过，除非它是在队列被刷新时推送*/
export function queueWatcher (watcher: Watcher) {
  /*获取watcher的id*/
  const id = watcher.id
  /*检验id是否存在，已经存在则直接跳过，不存在则标记哈希表has，用于下次检验*/
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      /*如果没有flush掉，直接push到队列中即可*/
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i >= 0 && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(Math.max(i, index) + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
```

查看queueWatcher的源码我们发现，Watch对象并不是立即更新视图，而是被push进了一个队列queue，此时状态处于waiting的状态，这时候会继续会有Watch对象被push进这个队列queue，等待下一个tick时，这些Watch对象才会被遍历取出，更新视图。

什么是下一个tick？

## nextTick

vue.js提供了一个[nextTick](https://cn.vuejs.org/v2/api/#Vue-nextTick)函数，其实也就是上面调用的nextTick。

nextTick的实现比较简单，执行的目的是在microtask或者task中推入一个funtion，在当前栈执行完毕（也行还会有一些排在前面的需要执行的任务）以后执行nextTick传入的funtion，看一下源码：

```javascript
/**
 * Defer a task to execute it asynchronously.
 */
 /*
    延迟一个任务使其异步执行，在下一个tick时执行，一个立即执行函数，返回一个function
    这个函数的作用是在task或者microtask中推入一个timerFunc，在当前调用栈执行完以后以此执行直到执行到timerFunc
    目的是延迟到当前调用栈执行完以后执行
*/
export const nextTick = (function () {
  /*存放异步执行的回调*/
  const callbacks = []
  /*一个标记位，如果已经有timerFunc被推送到任务队列中去则不需要重复推送*/
  let pending = false
  /*一个函数指针，指向函数将被推送到任务队列中，等到主线程任务执行完时，任务队列中的timerFunc被调用*/
  let timerFunc

  /*下一个tick时的回调*/
  function nextTickHandler () {
    /*一个标记位，标记等待状态（即函数已经被推入任务队列或者主线程，已经在等待当前栈执行完毕去执行），这样就不需要在push多个回调到callbacks时将timerFunc多次推入任务队列或者主线程*/
    pending = false
    /*执行所有callback*/
    const copies = callbacks.slice(0)
    callbacks.length = 0
    for (let i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }

  // the nextTick behavior leverages the microtask queue, which can be accessed
  // via either native Promise.then or MutationObserver.
  // MutationObserver has wider support, however it is seriously bugged in
  // UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
  // completely stops working after triggering a few times... so, if native
  // Promise is available, we will use it:
  /* istanbul ignore if */

  /*
    这里解释一下，一共有Promise、MutationObserver以及setTimeout三种尝试得到timerFunc的方法
    优先使用Promise，在Promise不存在的情况下使用MutationObserver，这两个方法都会在microtask中执行，会比setTimeout更早执行，所以优先使用。
    如果上述两种方法都不支持的环境则会使用setTimeout，在task尾部推入这个函数，等待调用执行。
    参考：https://www.zhihu.com/question/55364497
  */
  if (typeof Promise !== 'undefined' && isNative(Promise)) {
    /*使用Promise*/
    var p = Promise.resolve()
    var logError = err => { console.error(err) }
    timerFunc = () => {
      p.then(nextTickHandler).catch(logError)
      // in problematic UIWebViews, Promise.then doesn't completely break, but
      // it can get stuck in a weird state where callbacks are pushed into the
      // microtask queue but the queue isn't being flushed, until the browser
      // needs to do some other work, e.g. handle a timer. Therefore we can
      // "force" the microtask queue to be flushed by adding an empty timer.
      if (isIOS) setTimeout(noop)
    }
  } else if (typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]'
  )) {
    // use MutationObserver where native Promise is not available,
    // e.g. PhantomJS IE11, iOS7, Android 4.4
    /*新建一个textNode的DOM对象，用MutationObserver绑定该DOM并指定回调函数，在DOM变化的时候则会触发回调,该回调会进入主线程（比任务队列优先执行），即textNode.data = String(counter)时便会触发回调*/
    var counter = 1
    var observer = new MutationObserver(nextTickHandler)
    var textNode = document.createTextNode(String(counter))
    observer.observe(textNode, {
      characterData: true
    })
    timerFunc = () => {
      counter = (counter + 1) % 2
      textNode.data = String(counter)
    }
  } else {
    // fallback to setTimeout
    /* istanbul ignore next */
    /*使用setTimeout将回调推入任务队列尾部*/
    timerFunc = () => {
      setTimeout(nextTickHandler, 0)
    }
  }

  /*
    推送到队列中下一个tick时执行
    cb 回调函数
    ctx 上下文
  */
  return function queueNextTick (cb?: Function, ctx?: Object) {
    let _resolve
    /*cb存到callbacks中*/
    callbacks.push(() => {
      if (cb) {
        try {
          cb.call(ctx)
        } catch (e) {
          handleError(e, ctx, 'nextTick')
        }
      } else if (_resolve) {
        _resolve(ctx)
      }
    })
    if (!pending) {
      pending = true
      timerFunc()
    }
    if (!cb && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        _resolve = resolve
      })
    }
  }
})()
```

它是一个立即执行函数,返回一个queueNextTick接口。

传入的cb会被push进callbacks中存放起来，然后执行timerFunc（pending是一个状态标记，保证timerFunc在下一个tick之前只执行一次）。

timerFunc是什么？

看了源码发现timerFunc会检测当前环境而不同实现，其实就是按照Promise，MutationObserver，setTimeout优先级，哪个存在使用哪个，最不济的环境下使用setTimeout。

这里解释一下，一共有Promise、MutationObserver以及setTimeout三种尝试得到timerFunc的方法。
优先使用Promise，在Promise不存在的情况下使用MutationObserver，这两个方法的回调函数都会在microtask中执行，它们会比setTimeout更早执行，所以优先使用。
如果上述两种方法都不支持的环境则会使用setTimeout，在task尾部推入这个函数，等待调用执行。
为啥要用 microtask？我在顾轶灵在知乎的回答中学习到：
根据 HTML Standard，在每个 task 运行完以后，UI 都会重渲染，那么在 microtask 中就完成数据更新，
当前 task 结束就可以得到最新的 UI 了。反之如果新建一个 task 来做数据更新，那么渲染就会进行两次。
参考顾轶灵知乎的回答：https://www.zhihu.com/question/55364497/answer/144215284

首先是Promise，(Promise.resolve()).then()可以在microtask中加入它的回调，

MutationObserver新建一个textNode的DOM对象，用MutationObserver绑定该DOM并指定回调函数，在DOM变化的时候则会触发回调,该回调会进入microtask，即textNode.data = String(counter)时便会加入该回调。

setTimeout是最后的一种备选方案，它会将回调函数加入task中，等到执行。

综上，nextTick的目的就是产生一个回调函数加入task或者microtask中，当前栈执行完以后（可能中间还有别的排在前面的函数）调用该回调函数，起到了异步触发（即下一个tick时触发）的目的。

## 为什么要异步更新视图

来看一下下面这一段代码

```html
<template>
  <div>
    <div>{{test}}</div>
  </div>
</template>

```

```javascript
export default {
    data () {
        return {
            test: 0
        };
    },
    created () {
      for(let i = 0; i < 1000; i++) {
        this.test++;
      }
    }
}
```

现在有这样的一种情况，created的时候test的值会被++循环执行1000次。
每次++时，都会根据响应式触发setter->Dep->Watcher->update。
如果这时候没有异步更新视图，那么每次++都会直接操作DOM更新视图，这是非常消耗性能的。
所以Vue.js实现了一个queue队列，在下一个tick的时候会统一执行queue中Watcher的run，更新视图。
保证更新视图操作DOM的动作是在当前栈执行完以后下一个tick的时候调用，大大优化了性能。

所以我们需要在修改date中的数据后访问真实的DOM节点，只需要这样，我们把文章第一个例子进行修改。

```html
<template>
  <div>
    <div ref="test">{{test}}</div>
    <button @click="handleClick">tet</button>
  </div>
</template>

```

```javascript
export default {
    data () {
        return {
            test: 'begin'
        };
    },
    methods () {
        handleClick () {
            this.test = 'end';
            this.$nextTick(() => {
                console.log(this.$refs.test.innerText);//打印"end"
            });
            console.log(this.$refs.test.innerText);//打印“begin”
        }
    }
}
```