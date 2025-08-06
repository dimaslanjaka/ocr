import { defineConfig, build } from 'tsup';
import packageJson from './package.json' with { type: 'json' };
import path from 'upath';

// Packages that should be bundled
const bundledPackages = ['p-limit', 'deepmerge-ts', 'hexo-is', 'is-stream', 'markdown-it', 'node-cache'];

const externalDeps = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].filter(
  (pkgName) => !bundledPackages.includes(pkgName)
);

// Remove any possible tsup shims from the external array
const external = externalDeps.filter((dep) => !path.toUnix(dep).includes('/tsup/assets/'));

const config = defineConfig({
  minify: true,
  target: 'es2015',
  external,
  sourcemap: true,
  dts: false,
  format: 'iife',
  clean: true,
  injectStyle: true,
  esbuildOptions(options) {
    options.define = {
      'process.env.NODE_ENV': JSON.stringify('production')
    };
  }
});

(async () => {
  await build({ ...config, entry: ['src/public/**/*.js', 'src/public/**/*.ts'], outDir: 'public/js' });
})();
