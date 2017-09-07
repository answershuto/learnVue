/* @flow */

import config from 'core/config'

/**
 * Runtime helper for checking keyCodes from config.
 */
 /*从config配置中检查eventKeyCode是否存在*/
export function checkKeyCodes (
  eventKeyCode: number,
  key: string,
  builtInAlias: number | Array<number> | void
): boolean {
  const keyCodes = config.keyCodes[key] || builtInAlias
  if (Array.isArray(keyCodes)) {
    return keyCodes.indexOf(eventKeyCode) === -1
  } else {
    return keyCodes !== eventKeyCode
  }
}
