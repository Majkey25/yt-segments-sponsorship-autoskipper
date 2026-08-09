import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'dist', 'extension');
const releaseDir = path.join(root, 'dist', 'release');
const manifestPath = path.join(sourceDir, 'manifest.json');

await fsp.access(manifestPath);
const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
await fsp.mkdir(releaseDir, { recursive: true });

const stablePath = path.join(releaseDir, 'yt-segments-sponsorship-autoskipper.zip');
const versionedPath = path.join(
  releaseDir,
  `yt-segments-sponsorship-autoskipper-v${manifest.version}.zip`
);

await createZip(stablePath);
await fsp.copyFile(stablePath, versionedPath);

console.log(stablePath);
console.log(versionedPath);

function createZip(destination) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}