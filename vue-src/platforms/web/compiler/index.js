/* @flow */

import { isUnaryTag, canBeLeftOpenTag } from './util'
import { genStaticKeys } from 'shared/util'
import { createCompiler } from 'compiler/index'

import modules from './modules/index'
import directives from './directives/index'

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}

/*这里会根据不同平台传递不同的baseOptions创建编译器*/
const { compile, compileToFunctions } = createCompiler(baseOptions)
export { compile, compileToFunctions }
