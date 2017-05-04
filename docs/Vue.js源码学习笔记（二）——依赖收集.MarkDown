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