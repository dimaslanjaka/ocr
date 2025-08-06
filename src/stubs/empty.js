// Robust empty stub for Node.js modules in browser builds.
const emptyFn = new Proxy(function () {}, { get: () => emptyFn });
const emptyObj = new Proxy({}, { get: () => emptyFn });

export default emptyObj;
export const empty = emptyObj;

// Common Node.js API stubs
export const readdir = emptyFn;
export const lstatSync = emptyFn;
export const statSync = emptyFn;
export const readdirSync = emptyFn;
export const existsSync = emptyFn;
export const readFileSync = emptyFn;
export const writeFileSync = emptyFn;
export const createReadStream = emptyFn;
export const createWriteStream = emptyFn;
export const mkdirSync = emptyFn;
export const rmdirSync = emptyFn;
export const unlinkSync = emptyFn;
export const readlinkSync = emptyFn;
export const realpathSync = emptyFn;
export const copyFileSync = emptyFn;
export const appendFileSync = emptyFn;
export const accessSync = emptyFn;
export const constants = {
  R_OK: 4,
  W_OK: 2,
  X_OK: 1
};
export const join = (...args) => args.join('/');
export const resolve = (...args) => args.join('/');
export const sep = '/';
export const delimiter = ':';
