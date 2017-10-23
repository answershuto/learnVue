## 什么是Vue组件？

[组件 (Component) 是 Vue.js 最强大的功能之一。组件可以扩展 HTML 元素，封装可重用的代码。在较高层面上，组件是自定义元素，Vue.js 的编译器为它添加特殊功能。在有些情况下，组件也可以是原生 HTML 元素的形式，以 is 特性扩展。](https://cn.vuejs.org/v2/guide/components.html)

<br />
<br />

## Vue组件间通信

### 父组件向子组件通信

#### 方法一：props

使用[props](https://cn.vuejs.org/v2/guide/components.html#Prop)，父组件可以使用props向子组件传递数据。

父组件vue模板father.vue

```
<template>
    <child :msg="message"></child>
</template>

<script>

import child from './child.vue';

export default {
    components: {
        child
    },
    data () {
        return {
            message: 'father message';
        }
    }
}
</script>
```

子组件vue模板child.vue

```
<template>
    <div>{{msg}}</div>
</template>

<script>
export default {
    props: {
        msg: {
            type: String,
            required: true
        }
    }
}
</script>
```

<br />

#### 方法二 使用$children

使用[$children](https://cn.vuejs.org/v2/api/#vm-children)可以在父组件中访问子组件。

<br /> 
<br /> 

### 子组件向父组件通信

<br />

#### 方法一:使用[vue事件](https://cn.vuejs.org/v2/guide/components.html#使用-v-on-绑定自定义事件)

父组件向子组件传递事件方法，子组件通过$emit触发事件，回调给父组件。

父组件vue模板father.vue

```
<template>
    <child @msgFunc="func"></child>
</template>

<script>

import child from './child.vue';

export default {
    components: {
        child
    },
    methods: {
        func (msg) {
            console.log(msg);
        }
    }
}
</script>
```

子组件vue模板child.vue

```
<template>
    <button @click="handleClick">点我</button>
</template>

<script>
export default {
    props: {
        msg: {
            type: String,
            required: true
        }
    },
    methods () {
        handleClick () {
            //........
            this.$emit('msgFunc');
        }
    }
}
</script>
```

<br />

#### 方法二： 通过修改父组件传递的props来修改父组件数据

这种方法只能在父组件传递一个引用变量时可以使用，字面变量无法达到相应效果。因为引用变量最终无论是父组件中的数据还是子组件得到的props中的数据都是指向同一块内存地址，所以修改了子组件中props的数据即修改了父组件的数据。

但是并不推荐这么做，并不建议直接修改props的值，如果数据是用于显示修改的，在实际开发中我经常会将其放入data中，在需要回传给父组件的时候再用事件回传数据。这样做保持了组件独立以及解耦，不会因为使用同一份数据而导致数据流异常混乱，只通过特定的接口传递数据来达到修改数据的目的，而内部数据状态由专门的data负责管理。

<br />

#### 方法三：使用$parent

使用[$parent](https://cn.vuejs.org/v2/api/#vm-parent)可以访问父组件的数据。

<br />
<br />

### 非父子组件、兄弟组件之间的数据传递

非父子组件通信，Vue官方推荐[使用一个Vue实例作为中央事件总线](https://cn.vuejs.org/v2/guide/components.html#非父子组件通信)。

Vue内部有一个事件机制，可以参考[源码](https://github.com/vuejs/vue/blob/dev/src/core/instance/events.js)。

$on方法用来监听一个事件。

$emit用来触发一个事件。

```javascript
/*新建一个Vue实例作为中央事件总嫌*/
let event = new Vue();

/*监听事件*/
event.$on('eventName', (val) => {
    //......do something
});

/*触发事件*/
event.$emit('eventName', 'this is a message.');
```

<br />
<br />

### 多层级父子组件通信：

在Vue1.0中实现了$broadcast与$dispatch两个方法用来向子组件（或父组件）广播（或派发），当子组件（或父组件）上监听了事件并返回true的时候会向爷孙级组件继续广播（或派发）事件。但是这个方法在Vue2.0里面已经被移除了。

之前在学习饿了么的开源组件库[element](https://github.com/ElemeFE/element)的时候发现他们重新实现了broadcast以及dispatch的方法，以mixin的方式引入，具体可以参考[《说说element组件库broadcast与dispatch》](https://github.com/answershuto/learnVue/blob/master/docs/%E8%AF%B4%E8%AF%B4element%E7%BB%84%E4%BB%B6%E5%BA%93broadcast%E4%B8%8Edispatch.MarkDown)。但是跟Vue1.0的两个方法实现有略微的不同。这两个方法实现了向子孙组件事件广播以及向多层级父组件事件派发的功能。但是并非广义上的事件广播，它需要指定一个commentName进行向指定组件名组件定向广播（派发）事件。

其实这两个方法内部实现还是用到的还是$parent以及$children，用以遍历子节点或是逐级向上查询父节点，访问到指定组件名的时候，调用$emit触发指定事件。

<br />
<br />

### 复杂的单页应用数据管理

当应用足够复杂情况下，请使用[vuex](https://cn.vuejs.org/v2/guide/state-management.html)进行数据管理。