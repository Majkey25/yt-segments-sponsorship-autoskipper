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
const filterIds = ['2'];

await fs.rm(buildRoot, { recursive: true, force: true });
await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
await fs.mkdir(filtersDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const loader = new AssetsLoader();
await loader.load(filtersDir);

await copyStaticFiles();
await fs.cp(filtersDir, path.join(outputDir, 'filters'), { recursive: true });

const patcher = new ManifestPatcher();
patcher.patch(
  path.join(outputDir, 'manifest.json'),
  path.join(outputDir, 'filters'),
  {
    forceUpdate: true,
    ids: filterIds,
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
if (!manifest.declarative_net_request?.rule_resources?.some((rule) => rule.id === 'ruleset_2')) {
  throw new Error('AdGuard Base ruleset was not added to manifest.json');
}

console.log(`Built extension at ${outputDir}`);

async function copyStaticFiles() {
  const files = [
    'manifest.json',
    'popup.html',
    'popup.css',
    'popup.js',
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
      'adguard-content': path.join(root, 'src', 'adguard-content.js')
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