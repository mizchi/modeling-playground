import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('model generators run as native Node TypeScript without a loader', () => {
  const root = new URL('../', import.meta.url);
  assert.ok(existsSync(new URL('human/models/base45/src/build.ts', root)));
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { outputPath } from './modeling/asset-paths.ts';
    import { createTopologyBuilder } from './modeling/quad-topology.ts';
    const topology = createTopologyBuilder();
    topology.vertex([0, 1, 2], 'Root');
    console.log(JSON.stringify({ path: outputPath('base45.glb'), count: topology.data.positions.length }));
  `], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.deepEqual(JSON.parse(result), { path: 'human/models/base45/output/base45.glb', count: 1 });
});

test('type checking is separate from execution and runs in the standard test task', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.scripts.typecheck?.includes('tsc'));
  assert.match(pkg.scripts.test, /node --test .*\.test\.ts/);
  const recipe = readFileSync(new URL('../justfile', import.meta.url), 'utf8');
  assert.match(recipe, /test:\n\s+pnpm typecheck/);
  const config = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'));
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.erasableSyntaxOnly, true);
  assert.equal(config.compilerOptions.noEmit, true);
  assert.ok(config.include.includes('tests/types/**/*.ts'));
});

test('the native TypeScript checker is installed and uses the shared configuration', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.devDependencies['@typescript/native-preview']);
  assert.equal(pkg.scripts['typecheck:native'], 'tsgo --noEmit');
});
