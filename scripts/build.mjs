import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import {
  AssetsLoader,
  ManifestPatcher,
  excludeUnsafeRules
} from '@adguard/dnr-rulesets';
import { copyWar } from '@adguard/tswebextension/cli';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(root, '.build');
const filtersDir = path.join(buildRoot, 'filters');
const outputDir = path.join(root, 'dist', 'extension');
const MAX_STATIC_RULESETS = 100;
const recommendedFilterIds = [2, 3, 17];

await fs.rm(buildRoot, { recursive: true, force: true });
await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
await fs.mkdir(filtersDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const loader = new AssetsLoader();
await loader.load(filtersDir);

const catalog = await discoverFilterCatalog();
if (catalog.filters.length === 0) {
  throw new Error('No AdGuard Chromium MV3 rulesets were discovered');
}
await fs.writeFile(
  path.join(filtersDir, 'catalog.json'),
  JSON.stringify(catalog),
  'utf8'
);

await copyStaticFiles();
await fs.cp(filtersDir, path.join(outputDir, 'filters'), { recursive: true });

const discoveredIds = catalog.filters.map((filter) => String(filter.id));
const recommended = recommendedFilterIds
  .filter((id) => catalog.filters.some((filter) => filter.id === id))
  .map(String);

const patcher = new ManifestPatcher();
patcher.patch(
  path.join(outputDir, 'manifest.json'),
  path.join(outputDir, 'filters'),
  {
    forceUpdate: true,
    ids: discoveredIds,
    enabled: recommended,
    filtersMatch: 'declarative/*/ruleset_+([0-9]).json'
  }
);

await excludeUnsafeRules({
  dir: path.join(outputDir, 'filters', 'declarative'),
  prettifyJson: false,
  limit: 4900
});

await bundleRuntime();
await copyWar(path.join(outputDir, 'web-accessible-resources'));

const manifest = JSON.parse(await fs.readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const resources = manifest.declarative_net_request?.rule_resources || [];
if (!resources.some((rule) => rule.id === 'ruleset_2')) {
  throw new Error('AdGuard Base ruleset was not added to manifest.json');
}
if (resources.length > MAX_STATIC_RULESETS) {
  throw new Error(`Manifest declares ${resources.length} rulesets, above the ${MAX_STATIC_RULESETS} ruleset cap`);
}

console.log(`Built extension at ${outputDir} with ${resources.length} AdGuard rulesets`);

async function discoverFilterCatalog() {
  const declarativeDir = path.join(filtersDir, 'declarative');
  const entries = await fs.readdir(declarativeDir, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory() && /^ruleset_\d+$/.test(entry.name))
    .map((entry) => Number(entry.name.replace('ruleset_', '')))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b)
    .slice(0, MAX_STATIC_RULESETS);

  const metadata = await readFilterMetadata();
  const filters = [];

  for (const id of ids) {
    const rulesetPath = path.join(declarativeDir, `ruleset_${id}`, `ruleset_${id}.json`);
    try {
      await fs.access(rulesetPath);
    } catch {
      continue;
    }

    const source = findFilterMetadata(metadata, id);
    const name = readableText(source?.name) || `Filter ${id}`;
    const description = readableText(source?.description) || '';
    filters.push({
      id,
      name,
      description,
      group: inferGroup(name, description, source),
      recommended: recommendedFilterIds.includes(id)
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    maxStaticRulesets: MAX_STATIC_RULESETS,
    recommendedFilterIds: recommendedFilterIds.filter((id) => filters.some((filter) => filter.id === id)),
    filters
  };
}

async function readFilterMetadata() {
  for (const filename of ['filters_i18n.json', 'filter_i18n.json']) {
    try {
      return JSON.parse(await fs.readFile(path.join(filtersDir, filename), 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(`Unable to read ${filename}: ${error.message}`);
      }
    }
  }
  return null;
}

function findFilterMetadata(metadata, id) {
  if (!metadata) {
    return null;
  }

  const collections = [
    Array.isArray(metadata) ? metadata : null,
    Array.isArray(metadata.filters) ? metadata.filters : null,
    Array.isArray(metadata.filter) ? metadata.filter : null
  ].filter(Boolean);

  for (const collection of collections) {
    const match = collection.find((item) => Number(item?.id ?? item?.filterId) === id);
    if (match) {
      return match;
    }
  }

  if (typeof metadata === 'object') {
    return metadata[String(id)] || metadata[`filter_${id}`] || null;
  }
  return null;
}

function readableText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    for (const key of ['en', 'en-US', 'default']) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return value[key].trim();
      }
    }
    const first = Object.values(value).find((item) => typeof item === 'string' && item.trim());
    return first?.trim() || '';
  }
  return '';
}

function inferGroup(name, description, source) {
  const explicit = readableText(source?.groupName) || readableText(source?.group);
  if (explicit && !/^\d+$/.test(explicit)) {
    return explicit;
  }

  const text = `${name} ${description}`.toLowerCase();
  if (/tracking|privacy|url tracking/.test(text)) return 'Privacy and tracking';
  if (/cookie/.test(text)) return 'Cookie notices';
  if (/annoy|popup|widget|social|banner/.test(text)) return 'Annoyances';
  if (/security|malware|phishing|scam/.test(text)) return 'Security';
  if (/mobile/.test(text)) return 'Mobile';
  if (/german|french|spanish|dutch|russian|japanese|chinese|turkish|polish|italian|portuguese|czech|slovak|language/.test(text)) return 'Language-specific';
  if (/ad|base|easylist/.test(text)) return 'Ad blocking';
  return 'Other';
}

async function copyStaticFiles() {
  const files = [
    'manifest.json',
    'popup.html',
    'popup.css',
    'popup.js',
    'popup-youtube.js',
    'popup-adguard.js',
    'blocking-page.html',
    'blocking-page.css',
    'blocking-page.js',
    'content.js',
    'content.css',
    'NOTICE.md'
  ];

  for (const file of files) {
    await fs.copyFile(path.join(root, file), path.join(outputDir, file));
  }

  await fs.cp(path.join(root, 'lib'), path.join(outputDir, 'lib'), { recursive: true });
  await fs.cp(path.join(root, 'icons'), path.join(outputDir, 'icons'), { recursive: true });
}

function bundleRuntime() {
  const configuration = {
    mode: 'production',
    devtool: false,
    entry: {
      background: path.join(root, 'src', 'background.js'),
      'adguard-content': path.join(root, 'src', 'adguard-content.js'),
      'adguard-assistant': path.join(root, 'src', 'adguard-assistant.js')
    },
    output: {
      path: outputDir,
      filename: '[name].js'
    },
    resolve: {
      fallback: {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        vm: require.resolve('vm-browserify')
      }
    },
    optimization: {
      minimize: false
    }
  };

  return new Promise((resolve, reject) => {
    webpack(configuration, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }

      if (stats?.hasErrors()) {
        reject(new Error(stats.toString({ colors: false, all: false, errors: true, warnings: true })));
        return;
      }

      resolve();
    });
  });
}
