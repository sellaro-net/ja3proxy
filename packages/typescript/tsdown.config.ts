import { defineConfig } from 'tsdown';

// Build on the pinned development Node version; published code supports 22.14.
// Generated standalone validators are bundled without runtime npm dependencies.
export default defineConfig({
  entry: { index: 'src/index.ts', 'sync/index': 'src/sync/index.ts', 'sync/worker': 'src/sync/worker.ts' },
  format: 'cjs',
  platform: 'node',
  target: 'node22.14',
  deps: { neverBundle: ['@sellaro/ja3proxy'] },
  clean: true,
  dts: { generator: 'tsc' },
  sourcemap: false,
  minify: false,
  outExtensions({ format }) {
    return format === 'cjs' ? { js: '.cjs', dts: '.d.cts' } : { js: '.js', dts: '.d.ts' };
  },
  // scripts/build.mjs builds one CJS graph first, then only the ESM sync entries.
  // tsdown natively shims import.meta.url for worker-relative CJS lookup.
  outputOptions: { comments: { legal: true } },
});
