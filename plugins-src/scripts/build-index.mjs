import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync,
  existsSync, statSync, copyFileSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Curated first-launch default set. Maintainers edit this list.
export const DEFAULT_PLUGINS = [
  'com.coco.clipboard-stats',
  'com.coco.image-compressor',
  'com.coco.screen-color-picker',
];

const SEMVER = /^\d+\.\d+\.\d+([-+].+)?$/;
const CATEGORIES = new Set(['productivity', 'utilities', 'developer', 'media', 'fun', 'other']);

function validateManifest(m, dir) {
  for (const k of ['id', 'name', 'version']) {
    if (!m[k] || typeof m[k] !== 'string') {
      throw new Error(`${dir}: missing required field '${k}'`);
    }
  }
  if (!SEMVER.test(m.version)) throw new Error(`${dir}: version '${m.version}' is not semver`);
  if (m.category && !CATEGORIES.has(m.category)) {
    throw new Error(`${dir}: unknown category '${m.category}'`);
  }
  if (!Array.isArray(m.commands)) throw new Error(`${dir}: 'commands' must be an array`);
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function buildIndex({ pluginsDir, distDir, baseURL, defaultPlugins }) {
  // `zip` runs with cwd: pluginsDir, so the output path must be absolute —
  // otherwise a relative distDir (e.g. the CLI's "dist") resolves against
  // pluginsDir and the write fails. (The unit test passes an absolute temp
  // dir, which is why this only bit the real CLI run.)
  distDir = resolve(distDir);
  const zipsDir = join(distDir, 'zips');
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  mkdirSync(zipsDir, { recursive: true });

  const folders = readdirSync(pluginsDir)
    .filter((n) => !n.startsWith('.') && statSync(join(pluginsDir, n)).isDirectory())
    .sort();

  const plugins = [];
  const seenIDs = new Set();
  const seenNames = new Set();
  for (const folder of folders) {
    const dir = join(pluginsDir, folder);
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) throw new Error(`${folder}: no manifest.json`);
    const mainPath = join(dir, 'main.js');
    if (!existsSync(mainPath)) throw new Error(`${folder}: no main.js`);

    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    validateManifest(m, folder);

    // Anti-impersonation: ids and (case-insensitively) display names must be
    // unique across the catalog. A second plugin reusing a known name/id is the
    // documented typosquat attack vector (see deep-research R3).
    if (seenIDs.has(m.id)) throw new Error(`${folder}: duplicate plugin id '${m.id}'`);
    const nameKey = m.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) {
      throw new Error(`${folder}: duplicate plugin name '${m.name}' (impersonation guard)`);
    }
    seenIDs.add(m.id);
    seenNames.add(nameKey);

    // Risk surfacing (flag, not block): steer the human reviewer's attention to
    // plugins using the highest-impact bridges. GitHub Actions annotation.
    const mainSrc = readFileSync(mainPath, 'utf8');
    for (const risky of ['coco.shell.exec', 'coco.http.fetch']) {
      if (mainSrc.includes(risky)) {
        console.log(`::warning file=${join('plugins', folder, 'main.js')}::` +
          `${m.id} uses ${risky} — reviewer: confirm this use is legitimate`);
      }
    }

    const zipName = `${m.id}-${m.version}.zip`;
    const zipPath = join(zipsDir, zipName);
    // zip the folder so its top-level entry is the plugin dir (StoreInstaller
    // looks for a single top-level dir containing manifest.json).
    execFileSync('zip', ['-q', '-r', '-X', zipPath, folder], { cwd: pluginsDir });
    const sha = sha256File(zipPath);

    let iconURL;
    if (existsSync(join(dir, 'icon.png'))) {
      mkdirSync(join(distDir, 'icons'), { recursive: true });
      copyFileSync(join(dir, 'icon.png'), join(distDir, 'icons', `${m.id}.png`));
      iconURL = `${baseURL}/icons/${m.id}.png`;
    }

    plugins.push({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description ?? null,
      author: m.author ?? null,
      category: m.category ?? null,
      icon_url: iconURL ?? null,
      homepage: m.homepage ?? null,
      repository: m.repository ?? 'https://github.com/butterflydream-ai/Coco',
      screenshots: m.screenshots ?? null,
      download_url: `${baseURL}/zips/${zipName}`,
      sha256: sha,
      install_dir_name: folder,
    });
  }

  const known = new Set(plugins.map((p) => p.id));
  const resolvedDefaults = (defaultPlugins ?? []).filter((id) => known.has(id));

  const index = {
    schema_version: '1',
    updated_at: new Date().toISOString(),
    plugins,
    default_plugins: resolvedDefaults,
  };

  writeFileSync(join(distDir, 'index.json'), JSON.stringify(index, null, 2));

  const tpl = readFileSync(join(HERE, '..', 'web', 'template.html'), 'utf8');
  writeFileSync(join(distDir, 'index.html'), tpl);

  return index;
}

// CLI: node scripts/build-index.mjs <pluginsDir> <distDir> <baseURL>
if (process.argv[1] && process.argv[1].endsWith('build-index.mjs')) {
  const [, , pluginsDir = 'plugins', distDir = 'dist',
    baseURL = 'https://coco.butterflydream.ai/plugins'] = process.argv;
  const index = buildIndex({ pluginsDir, distDir, baseURL, defaultPlugins: DEFAULT_PLUGINS });
  console.log(`built index: ${index.plugins.length} plugins, ` +
    `${index.default_plugins.length} defaults`);
}
