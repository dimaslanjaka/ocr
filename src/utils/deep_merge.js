/**
 * Recursively creates a deep clone of the given value, handling circular references and special types.
 *
 * This function supports:
 * - Primitives (`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`)
 * - Arrays (including nested arrays)
 * - Plain objects (including nested objects)
 * - Special types: `Date`, `Map`, `Set`, `RegExp`, and `Function` (functions are returned as-is)
 * - Circular references (using WeakMap)
 *
 * Note: Functions are not cloned, but returned as-is. Other special types are deeply cloned.
 *
 * @template T
 * @param {T} param - The value to deep clone.
 * @param {WeakMap<object, any>} [seen=new WeakMap()] - Internal WeakMap to track circular references.
 * @returns {T} A deep clone of the input value.
 */
function deepClone(param, seen = new WeakMap()) {
  if (param === null || typeof param !== 'object') {
    return param;
  }

  if (param instanceof Date) {
    return /** @type {T} */ (new Date(param.getTime()));
  }
  if (param instanceof RegExp) {
    return /** @type {T} */ (new RegExp(param.source, param.flags));
  }
  if (param instanceof Map) {
    const result = new Map();
    seen.set(param, result);
    for (const [k, v] of param) {
      result.set(deepClone(k, seen), deepClone(v, seen));
    }
    return /** @type {T} */ (result);
  }
  if (param instanceof Set) {
    const result = new Set();
    seen.set(param, result);
    for (const v of param) {
      result.add(deepClone(v, seen));
    }
    return /** @type {T} */ (result);
  }
  if (typeof param === 'function') {
    return param;
  }

  if (seen.has(param)) {
    return seen.get(param);
  }

  if (Array.isArray(param)) {
    const arr = [];
    seen.set(param, arr);
    for (const item of param) {
      arr.push(deepClone(item, seen));
    }
    return /** @type {T} */ (arr);
  }

  const newObj = {};
  seen.set(param, newObj);

  for (const key in param) {
    if (Object.prototype.hasOwnProperty.call(param, key)) {
      newObj[key] = deepClone(param[key], seen);
    }
  }
  const symbols = Object.getOwnPropertySymbols(param);
  for (const sym of symbols) {
    newObj[sym] = deepClone(param[sym], seen);
  }

  return /** @type {T} */ (newObj);
}

/**
 * Checks if a value is a plain object (not an array, null, or special type).
 *
 * @param {unknown} item - The value to check.
 * @returns {item is Record<string, unknown>} True if the value is a plain object, false otherwise.
 */
function isObject(item) {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deeply merges two values, handling arrays, objects, and special types.
 *
 * - If both values are arrays, merges by index, unions nested arrays, and merges objects/maps/sets/functions at the same index.
 * - If both values are objects, merges properties recursively, handling special types (`Date`, `Map`, `Set`, `RegExp`, `Function`).
 * - If types differ, source replaces target.
 * - Handles circular references.
 *
 * @template T
 * @param {Partial<T>} target - The target value to merge into.
 * @param {Partial<T>} source - The source value to merge from.
 * @param {WeakMap<object, any>} [seen=new WeakMap()] - Internal WeakMap to track circular references.
 * @returns {T} The deeply merged value.
 */
function deepMerge(target, source, seen = new WeakMap()) {
  if (source === null || typeof source !== 'object') {
    return /** @type {T} */ (deepClone(source));
  }
  if (target === null || typeof target !== 'object') {
    return /** @type {T} */ (deepClone(source));
  }

  if (seen.has(target)) {
    return seen.get(target);
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    const maxLength = Math.max(target.length, source.length);
    const resultArr = [];
    seen.set(target, resultArr);
    for (let i = 0; i < maxLength; i++) {
      const tVal = target[i];
      const sVal = source[i];
      if (i in target && i in source) {
        if (Array.isArray(tVal) && Array.isArray(sVal)) {
          const union = [...tVal];
          for (const v of sVal) {
            if (!union.some((u) => u === v)) {
              union.push(v);
            }
          }
          resultArr[i] = union;
        } else if (Array.isArray(sVal)) {
          resultArr[i] = deepClone(sVal, seen);
        } else if (Array.isArray(tVal)) {
          resultArr[i] = deepClone(tVal, seen);
        } else if (isObject(tVal) && isObject(sVal)) {
          resultArr[i] = deepMerge(tVal, sVal, seen);
        } else if (tVal instanceof Date && sVal instanceof Date) {
          resultArr[i] = new Date(Math.max(tVal.getTime(), sVal.getTime()));
        } else if (tVal instanceof RegExp && sVal instanceof RegExp) {
          resultArr[i] = new RegExp(sVal.source, sVal.flags);
        } else if (tVal instanceof Map && sVal instanceof Map) {
          const merged = new Map(tVal);
          for (const [k, v] of sVal) {
            if (merged.has(k)) {
              merged.set(k, deepMerge(merged.get(k), v, seen));
            } else {
              merged.set(deepClone(k, seen), deepClone(v, seen));
            }
          }
          resultArr[i] = merged;
        } else if (tVal instanceof Set && sVal instanceof Set) {
          const merged = new Set(tVal);
          for (const v of sVal) {
            merged.add(deepClone(v, seen));
          }
          resultArr[i] = merged;
        } else if (typeof tVal === 'function' && typeof sVal === 'function') {
          resultArr[i] = sVal;
        } else if (typeof sVal !== 'undefined') {
          resultArr[i] = deepClone(sVal, seen);
        } else {
          resultArr[i] = deepClone(tVal, seen);
        }
      } else if (i in source) {
        resultArr[i] = deepClone(sVal, seen);
      } else if (i in target) {
        resultArr[i] = deepClone(tVal, seen);
      }
    }
    return /** @type {T} */ (resultArr);
  }

  if (isObject(target) && isObject(source)) {
    const resultObj = { ...target };
    seen.set(target, resultObj);
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const tVal = target[key];
        const sVal = source[key];
        if (key in target) {
          if (tVal instanceof Date && sVal instanceof Date) {
            resultObj[key] = new Date(Math.max(tVal.getTime(), sVal.getTime()));
          } else if (tVal instanceof RegExp && sVal instanceof RegExp) {
            resultObj[key] = new RegExp(sVal.source, sVal.flags);
          } else if (tVal instanceof Map && sVal instanceof Map) {
            const merged = new Map(tVal);
            for (const [k, v] of sVal) {
              if (merged.has(k)) {
                merged.set(k, deepMerge(merged.get(k), v, seen));
              } else {
                merged.set(deepClone(k, seen), deepClone(v, seen));
              }
            }
            resultObj[key] = merged;
          } else if (tVal instanceof Set && sVal instanceof Set) {
            const merged = new Set(tVal);
            for (const v of sVal) {
              merged.add(deepClone(v, seen));
            }
            resultObj[key] = merged;
          } else if (typeof tVal === 'function' && typeof sVal === 'function') {
            resultObj[key] = sVal;
          } else {
            resultObj[key] = deepMerge(tVal, sVal, seen);
          }
        } else {
          resultObj[key] = deepClone(sVal, seen);
        }
      }
    }
    const sourceSymbols = Object.getOwnPropertySymbols(source);
    for (const sym of sourceSymbols) {
      const tVal = target[sym];
      const sVal = source[sym];
      if (Object.prototype.hasOwnProperty.call(target, sym)) {
        if (tVal instanceof Date && sVal instanceof Date) {
          resultObj[sym] = new Date(Math.max(tVal.getTime(), sVal.getTime()));
        } else if (tVal instanceof RegExp && sVal instanceof RegExp) {
          resultObj[sym] = new RegExp(sVal.source, sVal.flags);
        } else if (tVal instanceof Map && sVal instanceof Map) {
          const merged = new Map(tVal);
          for (const [k, v] of sVal) {
            if (merged.has(k)) {
              merged.set(k, deepMerge(merged.get(k), v, seen));
            } else {
              merged.set(deepClone(k, seen), deepClone(v, seen));
            }
          }
          resultObj[sym] = merged;
        } else if (tVal instanceof Set && sVal instanceof Set) {
          const merged = new Set(tVal);
          for (const v of sVal) {
            merged.add(deepClone(v, seen));
          }
          resultObj[sym] = merged;
        } else if (typeof tVal === 'function' && typeof sVal === 'function') {
          resultObj[sym] = sVal;
        } else {
          resultObj[sym] = deepMerge(tVal, sVal, seen);
        }
      } else {
        resultObj[sym] = deepClone(sVal, seen);
      }
    }
    return /** @type {T} */ (resultObj);
  }

  return /** @type {T} */ (deepClone(source));
}

// ESM export
export default deepMerge;

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports === 'object' && module.exports !== null) {
  module.exports = deepMerge;
  module.exports.default = deepMerge;
}
