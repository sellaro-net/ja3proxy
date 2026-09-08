import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { compile } from 'json-schema-to-typescript';
import { build } from 'esbuild';

const sdkRoot = fileURLToPath(new URL('..', import.meta.url));
const contractsRoot = resolve(sdkRoot, '../../contracts');
const generatedRoot = resolve(sdkRoot, 'src/generated');
const banner = '// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.\n';
const names = [
  'requestMetadata', 'responseMetadata', 'diagnostics', 'transportError',
  'contextInfo', 'cookieRecord', 'cookieSnapshot', 'capabilities',
  'createContext', 'cookieOperation', 'cookieReply', 'requestStatus',
];
const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (flag !== '--check' && flag !== '--check-fixtures') {
    throw new Error(`Unknown contract generation option: ${flag}`);
  }
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// Schemars describes Rust u64/usize exactly. A JS SDK cannot faithfully represent
// their full domain, so narrow numeric schemas explicitly, without editing the
// authoritative Rust schemas or pretending Rust itself rejects these integers.
function constrainIntegers(schema) {
  if (schema === null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const child of schema) constrainIntegers(child);
    return;
  }
  const integer = schema.type === 'integer'
    || (Array.isArray(schema.type) && schema.type.includes('integer'));
  if (integer) {
    schema.maximum = Math.min(schema.maximum ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    schema.minimum = Math.max(schema.minimum ?? Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  }
  for (const child of Object.values(schema)) constrainIntegers(child);
}

async function checkFixtures(validators) {
  const document = await json(resolve(contractsRoot, 'fixtures/wire.json'));
  assert.equal(document.formatVersion, 1);
  const seen = new Set();
  for (const fixture of document.fixtures) {
    assert(names.includes(fixture.contract), `Unknown fixture contract: ${fixture.contract}`);
    assert(!seen.has(fixture.name), `Duplicate fixture: ${fixture.name}`);
    seen.add(fixture.name);
    assert.equal(typeof fixture.rustAccepts, 'boolean', fixture.name);
    assert.equal(typeof fixture.valid, 'boolean', fixture.name);
    assert.equal(validators[fixture.contract](fixture.value), fixture.valid,
      `${fixture.name}: ${fixture.reason} (Rust deserialization: ${fixture.rustAccepts})`);
  }
  const semantics = await json(resolve(contractsRoot, 'fixtures/request-semantics.json'));
  for (const fixture of semantics.fixtures) {
    assert.equal(validators.requestMetadata(fixture.value), fixture.schemaValid,
      `${fixture.name}: schema validity must stay distinct from handler semantics`);
  }
  // JSON cannot carry these values. The live JS boundary must nevertheless reject
  // them before encoding instead of silently turning non-finite values into null.
  const baseline = document.fixtures.find((fixture) => fixture.name === 'diagnostics-rust-serialized');
  assert(baseline, 'Missing actual Rust diagnostics fixture');
  for (const responseBytes of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validators.diagnostics({ ...baseline.value, responseBytes }), false,
      'Non-exact diagnostics counters must not enter the SDK');
  }
  console.log(`${document.fixtures.length} Rust/JS wire fixtures verified.`);
}

if (flags.has('--check-fixtures') && !flags.has('--check')) {
  await checkFixtures(await import(pathToFileURL(resolve(generatedRoot, 'compiled-validators.js')).href));
} else {
  const manifest = await json(resolve(contractsRoot, 'manifest.json'));
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.javascriptSafeIntegers, true);
  assert.deepEqual(manifest.contracts.map((entry) => entry.name), names,
    'Frozen wire contract names changed; migrate consumers deliberately.');
  const ajv = new Ajv({
    strict: true,
    validateFormats: false, // Rust integer format annotations are not JSON string formats.
    allErrors: false,
    code: { source: true, esm: true, optimize: true },
  });
  const outputs = new Map();
  const exports = {};
  const typeImports = [];
  const typeExports = [];
  const typeMembers = [];
  for (const entry of manifest.contracts) {
    assert.match(entry.typeName, /^[A-Z][A-Za-z0-9]*$/);
    assert.equal(entry.schema, `schemas/${entry.name}.schema.json`);
    const schema = await json(resolve(contractsRoot, entry.schema));
    assert.equal(schema.title, entry.typeName);
    assert.equal(typeof schema.$id, 'string');
    constrainIntegers(schema);
    ajv.addSchema(schema);
    exports[entry.name] = schema.$id;
    const types = await compile(schema, entry.typeName, {
      bannerComment: banner.trimEnd(),
      additionalProperties: true,
      unknownAny: true,
      enableConstEnums: false,
      unreachableDefinitions: true,
      cwd: contractsRoot,
      style: { singleQuote: true },
    });
    outputs.set(`types/${entry.name}.ts`, types);
    typeImports.push(`import type { ${entry.typeName} } from './types/${entry.name}.js';`);
    typeExports.push(`export type { ${entry.typeName} } from './types/${entry.name}.js';`);
    typeMembers.push(`  ${entry.name}: ${entry.typeName};`);
  }
  // AJV executes only at generation time. Bundle its small standalone helpers too;
  // packaged SDK consumers neither depend on AJV nor compile schemas at runtime.
  const standalone = standaloneCode(ajv, exports);
  const bundle = await build({
    stdin: { contents: standalone, resolveDir: sdkRoot, sourcefile: 'standalone-validators.js' },
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'esm',
    target: 'es2022',
    legalComments: 'inline',
    charset: 'utf8',
  });
  assert.equal(bundle.outputFiles.length, 1);
  const require = createRequire(import.meta.url);
  const ajvLicense = await readFile(resolve(dirname(require.resolve('ajv/package.json')), 'LICENSE'), 'utf8');
  const compiled = banner + `/*! Bundled AJV standalone helpers\n${ajvLicense}\n*/\n` + bundle.outputFiles[0].text;
  outputs.set('compiled-validators.js', compiled);
  outputs.set('compiled-validators.d.ts', banner + names.map((name) =>
    `export declare function ${name}(value: unknown): boolean;`).join('\n') + '\n');
  outputs.set('wire-types.ts', banner + typeImports.join('\n') + '\n\n'
    + typeExports.join('\n') + '\n\nexport interface WireContracts {\n'
    + typeMembers.join('\n') + '\n}\n\nexport type WireContractName = keyof WireContracts;\n');
  outputs.set('validators.ts', banner
    + "import * as validators from './compiled-validators.js';\n"
    + "import type { WireContractName } from './wire-types.js';\n"
    + "export type { WireContractName } from './wire-types.js';\n\n"
    + 'export function validateWire(name: WireContractName, value: unknown): boolean {\n'
    + '  return validators[name](value);\n}\n');

  // Verify the exact standalone artifact, not AJV's in-memory compiler instance.
  const generatedModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  await checkFixtures(generatedModule);
  for (const [relative, expected] of outputs) {
    const path = resolve(generatedRoot, relative);
    if (flags.has('--check')) {
      assert.equal(await readFile(path, 'utf8'), expected, `Generated contract drift: ${relative}`);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, expected);
    }
  }
  console.log(`${outputs.size} generated SDK contract files ${flags.has('--check') ? 'checked' : 'written'}.`);
}
