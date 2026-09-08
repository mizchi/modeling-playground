import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, mkdtempSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { outputPath, assetUrl, modelDirectories } from '../modeling/asset-paths.ts';
import { prepareOutput } from '../modeling/output.ts';

test('each model family owns separate source and output directories', () => {
  for (const directory of Object.values(modelDirectories)) {
    for (const child of ['src', 'output']) {
      assert.ok(existsSync(new URL(`../${directory}/${child}/`, import.meta.url)), `${directory}/${child}`);
    }
  }
  assert.ok(readdirSync(new URL('../models/', import.meta.url)).every(name => !name.endsWith('.ts')));
  assert.ok(!existsSync(new URL('../output/', import.meta.url)), 'No shared flat output directory');
});

test('a copied model can create its own output directory without a repository-root working directory', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'model-output-'));
  try {
    const source = pathToFileURL(join(directory, 'src', 'build.ts'));
    const output = await prepareOutput(source);
    assert.equal(output.href, pathToFileURL(join(directory, 'output') + '/').href);
    assert.ok(existsSync(output));
    assert.equal((await prepareOutput(source)).href, output.href);
  } finally {
    if (existsSync(join(directory, 'output'))) rmdirSync(join(directory, 'output'));
    rmdirSync(directory);
  }
});

test('variant assets resolve within their family, independently of the working directory', () => {
  assert.equal(outputPath('base45.glb'), 'human/models/base45/output/base45.glb');
  assert.equal(outputPath('human-female.obj'), 'human/models/base45/output/human-female.obj');
  assert.equal(outputPath('human-side-tail.glb'), 'human/models/lumi/output/human-side-tail.glb');
  assert.equal(outputPath('strix.glb'), 'robot/models/strix/output/strix.glb');
  assert.equal(outputPath('corgi-chibi.glb'), 'models/dog/output/corgi-chibi.glb');
  assert.equal(outputPath('traveler-walk.glb'), 'human/models/traveler/output/traveler-walk.glb');
  assert.ok(existsSync(assetUrl('base45.glb')));
  for (const unsafe of ['../base45.glb', '/base45.glb', 'base45/../../x', 'unknown.glb']) {
    assert.throws(() => outputPath(unsafe));
  }
});

test('catalog model IDs are unique and each GLB resolves to its owning directory', () => {
  const ids = new Set();
  for (const directory of Object.values(modelDirectories)) {
    for (const file of readdirSync(new URL(`../${directory}/output/`, import.meta.url))) {
      if (!file.endsWith('.glb')) continue;
      const id = file.slice(0, -4);
      assert.ok(!ids.has(id), `Duplicate catalog model ID: ${id}`);
      ids.add(id);
      assert.equal(outputPath(file), `${directory}/output/${file}`);
    }
  }
  for (const id of ['base45', 'lumi', 'raven', 'strix', 'human-female', 'human-side-tail']) assert.ok(ids.has(id));
});
