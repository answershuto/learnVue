/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { detectErrors } from './error-detector'
import { extend, noop } from 'shared/util'
import { warn, tip } from 'core/util/debug'

function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  /*parse解析得到ast树*/
  const ast = parse(template.trim(), options)
  /*
    将AST树进行优化
    优化的目标：生成模板AST树，检测不需要进行DOM改变的静态子树。
    一旦检测到这些静态树，我们就能做以下这些事情：
    1.把它们变成常数，这样我们就再也不需要每次重新渲染时创建新的节点了。
    2.在patch的过程中直接跳过。
 */
  optimize(ast, options)
  /*根据ast树生成所需的code（内部包含render与staticRenderFns）*/
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
}

/*新建成Funtion对象*/
function makeFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

/*提供一个方法，根据传递的baseOptions（不同平台可以有不同的实现）创建相应的编译器*/
export function createCompiler (baseOptions: CompilerOptions) {
  /*
    作为缓存，防止每次都重新编译。
    模板的key为delimiters(https://cn.vuejs.org/v2/api/#delimiters)+template，value为编译结果
  */
  const functionCompileCache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  /*编译，将模板template编译成AST树、render函数以及staticRenderFns函数*/
  function compile (
    template: string,
    options?: CompilerOptions
  ): CompiledResult {
    const finalOptions = Object.create(baseOptions)
    const errors = []
    const tips = []
    finalOptions.warn = (msg, tip) => {
      (tip ? tips : errors).push(msg)
    }

    /*做下面这些merge的目的因为不同平台可以提供自己本身平台的一个baseOptions，内部封装了平台自己的实现，然后把共同的部分抽离开来放在这层compiler中，所以在这里需要merge一下*/
    if (options) {
      // merge custom modules
      /*合并modules*/
      if (options.modules) {
        finalOptions.modules = (baseOptions.modules || []).concat(options.modules)
      }
      // merge custom directives
      if (options.directives) {
        /*合并directives*/
        finalOptions.directives = extend(
          Object.create(baseOptions.directives),
          options.directives
        )
      }
      // copy other options
      for (const key in options) {
        /*合并其余的options，modules与directives已经在上面做了特殊处理了*/
        if (key !== 'modules' && key !== 'directives') {
          finalOptions[key] = options[key]
        }
      }
    }

    /*基础模板编译，得到编译结果*/
    const compiled = baseCompile(template, finalOptions)
    if (process.env.NODE_ENV !== 'production') {
      errors.push.apply(errors, detectErrors(compiled.ast))
    }
    compiled.errors = errors
    compiled.tips = tips
    return compiled
  }

  /*带缓存的编译器，同时staticRenderFns以及render函数会被转换成Funtion对象*/
  function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = options || {}

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    /*有缓存的时候直接取出缓存中的结果即可*/
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (functionCompileCache[key]) {
      return functionCompileCache[key]
    }

    // compile
    /*编译*/
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    /*将render转换成Funtion对象*/
    res.render = makeFunction(compiled.render, fnGenErrors)
    /*将staticRenderFns全部转化成Funtion对象 */
    const l = compiled.staticRenderFns.length
    res.staticRenderFns = new Array(l)
    for (let i = 0; i < l; i++) {
      res.staticRenderFns[i] = makeFunction(compiled.staticRenderFns[i], fnGenErrors)
    }

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    /*存放在缓存中，以免每次都重新编译*/
    return (functionCompileCache[key] = res) 
  }

  return {
    compile,
    compileToFunctions
  }
}
/*Github:https://github.com/answershuto*/