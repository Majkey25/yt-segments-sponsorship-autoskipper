const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('package metadata defines the public project and build commands', () => {
  const packageJson = readJson('package.json');

  assert.equal(packageJson.name, 'yt-segments-sponsorship-autoskipper');
  assert.equal(packageJson.license, 'GPL-3.0-only');
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.js');
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.package, 'node scripts/package.mjs');
});

test('manifest declares the AdGuard MV3 runtime and branded extension metadata', () => {
  const manifest = readJson('manifest.json');

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'YT Segments & Sponsor Autoskipper');
  assert.equal(manifest.minimum_chrome_version, '121');
  assert.ok(manifest.permissions.includes('declarativeNetRequest'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.host_permissions.includes('<all_urls>'));
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.equal(manifest.icons['128'], 'icons/icon-128.png');
});

test('manifest runs AdGuard globally before page load and SponsorBlock only on YouTube', () => {
  const manifest = readJson('manifest.json');
  const adguardScript = manifest.content_scripts.find((entry) => entry.js.includes('adguard-content.js'));
  const segmentScript = manifest.content_scripts.find((entry) => entry.js.includes('content.js'));

  assert.equal(adguardScript.run_at, 'document_start');
  assert.equal(adguardScript.all_frames, true);
  assert.deepEqual(adguardScript.matches, ['<all_urls>']);
  assert.equal(segmentScript.run_at, 'document_idle');
  assert.ok(!segmentScript.matches.includes('<all_urls>'));
  assert.ok(segmentScript.matches.every((pattern) => pattern.includes('youtube.com')));
});

test('popup exposes global ad blocking and advanced scope controls', () => {
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');

  assert.match(html, /id="adBlockEnabled"/);
  assert.match(html, /id="adBlockScopeStatus"/);
  assert.match(html, /id="advancedToggle"/);
  assert.match(html, /id="adBlockScope"/);
  assert.match(html, /value="global"/);
  assert.match(html, /value="youtube"/);
  assert.match(html, /id="theme"/);
  assert.match(script, /adBlockEnabled/);
  assert.match(script, /settings\.adBlockScope/);
  assert.match(script, /settings\.theme/);
});
