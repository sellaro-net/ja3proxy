import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'tsdown';
import configuration from '../tsdown.config.ts';

const cwd = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(cwd, 'dist');

// The root owns classes and Response completion WeakMaps exactly once. Build
// it together with CJS sync entries/workers to share the validator chunk. Preserve
// that whole graph while building ESM sync entries/workers next. Never run
// these builds concurrently against one dist.
await build({ ...configuration, config: false, cwd });
await build({
  ...configuration, config: false, cwd, clean: false,
  entry: { 'sync/index': 'src/sync/index.ts', 'sync/worker': 'src/sync/worker.ts' },
  format: 'esm',
});

// Node's canonical CommonJS + ESM-wrapper pattern avoids the dual-package
// hazard. Derive the public runtime names from the completed CJS module rather
// than keeping a second manually maintained export list or global registry.
const require = createRequire(import.meta.url);
const canonical = require(join(dist, 'index.cjs'));
const names = Object.keys(canonical).filter(name => name !== '__esModule').sort();
assert.ok(names.length > 0, 'The canonical root must expose public runtime exports.');
for (const name of names) assert.match(name, /^[$A-Z_a-z][$\w]*$/, `Unsupported runtime export name: ${name}`);
const exports = names.map((name, index) => `const value${index} = canonical[${JSON.stringify(name)}];\nexport { value${index} as ${name} };`).join('\n');
await writeFile(join(dist, 'index.js'), `// Generated ESM view of the canonical CommonJS implementation.\nimport canonical from './index.cjs';\n${exports}\n`);
// Both resolution modes must resolve the same class declarations, including
// private fields. Re-emitting a second root .d.ts would duplicate nominal types.
await writeFile(join(dist, 'index.d.ts'), "export * from './index.cjs';\n");
