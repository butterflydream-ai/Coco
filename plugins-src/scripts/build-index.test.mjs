import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from './build-index.mjs';

const root = mkdtempSync(join(tmpdir(), 'coco-idx-'));
const pluginsDir = join(root, 'plugins');
const distDir = join(root, 'dist');
mkdirSync(join(pluginsDir, 'demo'), { recursive: true });
writeFileSync(join(pluginsDir, 'demo', 'manifest.json'), JSON.stringify({
  id: 'com.coco.demo', name: 'Demo', version: '1.2.3',
  description: 'A demo.', author: 'Coco', category: 'utilities',
  commands: [{ id: 'go', title: 'Go' }]
}));
writeFileSync(join(pluginsDir, 'demo', 'main.js'), 'coco.commands.on("go",()=>{});');

const index = buildIndex({
  pluginsDir, distDir,
  baseURL: 'https://coco.butterflydream.ai/plugins',
  defaultPlugins: ['com.coco.demo'],
});

assert.equal(index.schema_version, '1');
assert.equal(index.plugins.length, 1);
const e = index.plugins[0];
assert.equal(e.id, 'com.coco.demo');
assert.equal(e.version, '1.2.3');
assert.equal(e.install_dir_name, 'demo');
assert.equal(e.download_url, 'https://coco.butterflydream.ai/plugins/zips/com.coco.demo-1.2.3.zip');
assert.match(e.sha256, /^[0-9a-f]{64}$/);
assert.deepEqual(index.default_plugins, ['com.coco.demo']);

// zip + index actually written to dist
const written = JSON.parse(readFileSync(join(distDir, 'index.json'), 'utf8'));
assert.equal(written.plugins[0].sha256, e.sha256);
rmSync(join(distDir, 'zips', 'com.coco.demo-1.2.3.zip')); // throws if missing

// invalid manifest must throw
mkdirSync(join(pluginsDir, 'bad'), { recursive: true });
writeFileSync(join(pluginsDir, 'bad', 'manifest.json'), JSON.stringify({ name: 'No ID' }));
writeFileSync(join(pluginsDir, 'bad', 'main.js'), '');
assert.throws(() => buildIndex({ pluginsDir, distDir, baseURL: 'x', defaultPlugins: [] }),
  /missing required field 'id'/);
rmSync(root, { recursive: true, force: true });

// impersonation guard: a second plugin reusing an existing display name throws
const root2 = mkdtempSync(join(tmpdir(), 'coco-idx2-'));
const pdir2 = join(root2, 'plugins');
for (const [folder, id] of [['a', 'com.coco.a'], ['b', 'com.evil.a']]) {
  mkdirSync(join(pdir2, folder), { recursive: true });
  writeFileSync(join(pdir2, folder, 'manifest.json'), JSON.stringify({
    id, name: 'Same Name', version: '1.0.0', commands: [],
  }));
  writeFileSync(join(pdir2, folder, 'main.js'), '');
}
assert.throws(
  () => buildIndex({ pluginsDir: pdir2, distDir: join(root2, 'dist'), baseURL: 'x', defaultPlugins: [] }),
  /duplicate plugin name .*impersonation guard/);
rmSync(root2, { recursive: true, force: true });

console.log('build-index.test.mjs OK');
