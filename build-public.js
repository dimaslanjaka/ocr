import alias from 'esbuild-plugin-alias';
import { dirname } from 'path';
import { build, defineConfig } from 'tsup';
import path from 'upath';
import { fileURLToPath } from 'url';
import packageJson from './package.json' with { type: 'json' };
import { createRequire } from 'module';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

// Dynamically resolve the path to url-browserify and path-browserify for esbuild-plugin-alias
const require = createRequire(import.meta.url);
const urlBrowserifyPath = require.resolve('url-browserify');
const pathBrowserifyPath = require.resolve('path-browserify');

// Packages that should be bundled
const bundledPackages = ['p-limit', 'deepmerge-ts', 'hexo-is', 'is-stream', 'markdown-it', 'node-cache'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const emptyStubPath = fileURLToPath(new URL('./src/stubs/empty.js', import.meta.url));

const externalDeps = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].filter(
  (pkgName) => !bundledPackages.includes(pkgName)
);

// Remove any possible tsup shims from the external array
const _external = externalDeps.filter((dep) => !path.toUnix(dep).includes('/tsup/assets/'));

const config = defineConfig({
  minify: false,
  target: 'es5',
  // external,
  sourcemap: true,
  dts: false,
  format: 'iife',
  clean: false,
  esbuildOptions(options) {
    options.define = {
      'process.env.NODE_ENV': JSON.stringify('production')
    };
  },
  esbuildPlugins: [
    alias({
      path: pathBrowserifyPath,
      fs: emptyStubPath,
      upath: emptyStubPath,
      'fs-extra': emptyStubPath,
      crypto: emptyStubPath,
      url: urlBrowserifyPath
    }),
    nodeModulesPolyfillPlugin()
  ]
});

(async () => {
  await build({ ...config, entry: ['src/public/**/*.js', 'src/public/**/*.ts'], outDir: 'public/js' });
})();
