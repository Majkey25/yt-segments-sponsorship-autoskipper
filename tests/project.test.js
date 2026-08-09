const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertProjectFile(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
}

test('package and manifest versions are aligned at v1.2.0', () => {
  const packageJson = readJson('package.json');
  const manifest = readJson('manifest.json');

  assert.equal(packageJson.name, 'yt-segments-sponsorship-autoskipper');
  assert.equal(packageJson.version, '1.2.0');
  assert.equal(manifest.version, '1.2.0');
  assert.equal(packageJson.license, 'GPL-3.0-only');
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.js');
  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.package, 'node scripts/package.mjs');
});

test('manifest keeps global AdGuard runtime and YouTube-only segment runtime', () => {
  const manifest = readJson('manifest.json');
  const adguardScript = manifest.content_scripts.find((entry) => entry.js.includes('adguard-content.js'));
  const segmentScript = manifest.content_scripts.find((entry) => entry.js.includes('content.js'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '121');
  assert.ok(manifest.permissions.includes('declarativeNetRequest'));
  assert.ok(manifest.permissions.includes('declarativeNetRequestFeedback'));
  assert.ok(manifest.permissions.includes('webRequest'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.host_permissions.includes('<all_urls>'));
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.deepEqual(adguardScript.matches, ['<all_urls>']);
  assert.equal(adguardScript.run_at, 'document_start');
  assert.ok(!segmentScript.matches.includes('<all_urls>'));
  assert.ok(segmentScript.matches.every((pattern) => pattern.includes('youtube.com')));
});

test('popup contains exactly two top-level tabs and split scripts', () => {
  const html = readText('popup.html');

  const tabMatches = html.match(/role="tab"/g) || [];
  assert.equal(tabMatches.length, 2);
  assert.match(html, /id="youtubeTab"/);
  assert.match(html, /id="adguardTab"/);
  assert.match(html, /id="youtubePanel"/);
  assert.match(html, /id="adguardPanel"/);
  assert.match(html, />YouTube Segments</);
  assert.match(html, />AdGuard</);
  assert.match(html, /src="popup-youtube\.js"/);
  assert.match(html, /src="popup-adguard\.js"/);
  assertProjectFile('popup-youtube.js');
  assertProjectFile('popup-adguard.js');
});

test('primary popup UI uses product-owned segment naming while keeping attribution', () => {
  const html = readText('popup.html');
  const primaryUi = html.replace(/<footer[\s\S]*?<\/footer>/i, '');

  assert.doesNotMatch(primaryUi, />SponsorBlock</);
  assert.match(primaryUi, /YouTube Segments/);
  assert.match(html, /SponsorBlock/);
  assert.match(html, /AdGuard/);
});

test('AdGuard tab exposes complete browser-side controls', () => {
  const html = readText('popup.html');

  for (const id of [
    'adguardEnabled',
    'adguardScope',
    'currentSiteProtection',
    'filterPreset',
    'filterPresetHelp',
    'filterSearch',
    'filterList',
    'enabledFilterCount',
    'rulesCount',
    'rulesetQuota',
    'allowlistEditor',
    'allowlistApply',
    'allowlistCurrentSite',
    'allowlistCopy',
    'userRulesEditor',
    'userRulesApply',
    'userRulesReset',
    'userRulesCopy',
    'assistantOpen',
    'assistantClose',
    'requestLog',
    'requestLogScope',
    'requestLogClear',
    'adguardDiagnostics',
    'adguardStart',
    'adguardStop',
    'adguardStatus'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /DNS-level protection requires a separate/);
  assert.match(html, /value="global"/);
  assert.match(html, /value="youtube"/);
});

test('AdGuard filter presets are documented and wired through the existing settings pipeline', () => {
  const html = readText('popup.html');
  const popupAdguard = readText('popup-adguard.js');

  assert.match(html, /<option value="minimal">Minimal<\/option>/);
  assert.match(html, /<option value="recommended">Recommended<\/option>/);
  assert.match(html, /<option value="strict">Strict<\/option>/);
  assert.match(html, /<option value="custom" disabled>Custom<\/option>/);
  assert.match(html, /Core ad blocking/);
  assert.match(html, /Balanced ads/);
  assert.match(html, /May break more sites/);
  assert.match(html, /manually selected filter combination/);
  assert.match(popupAdguard, /presetForFilterIds/);
  assert.match(popupAdguard, /filterIdsForPreset/);
  assert.match(popupAdguard, /filterPreset\.addEventListener\('change'/);
  assert.match(popupAdguard, /applyAdguard/);
});

test('manual segment skip button uses native-like structure and neutral styling', () => {
  const content = readText('content.js');
  const css = readText('content.css');

  assert.match(content, /majkey-segment-skip-text/);
  assert.match(content, /majkey-segment-skip-icon/);
  assert.doesNotMatch(content, /style\.setProperty\('--segment-color'/);
  assert.doesNotMatch(css, /var\(--segment-color\)/);
  assert.match(css, /\.majkey-segment-skip-button\s*\{[\s\S]*display:\s*inline-flex/);
  assert.match(css, /border:\s*1px solid rgba\(/);
  assert.match(css, /background:\s*rgba\(/);
  assert.match(css, /font:\s*500 14px\/1 Roboto/);
  assert.match(css, /\.majkey-segment-skip-icon::before/);
  assert.match(css, /\.majkey-segment-skip-icon::after/);
  assert.match(css, /\.majkey-segment-skip-button:focus-visible/);
  assert.match(css, /\.ytp-fullscreen \.majkey-segment-skip-button/);
});

test('background exposes all public AdGuard API operations and dashboard messages', () => {
  const background = readText('src/background.js');

  for (const token of [
    'getRulesCount',
    'onAssistantCreateRule.subscribe',
    'onRequestBlocked.addListener',
    'openAssistant',
    'closeAssistant',
    '.start(',
    '.stop(',
    '.configure(',
    'GET_ADGUARD_STATE',
    'APPLY_ADGUARD_SETTINGS',
    'START_ADGUARD',
    'STOP_ADGUARD',
    'OPEN_ADGUARD_ASSISTANT',
    'CLOSE_ADGUARD_ASSISTANT',
    'GET_ADGUARD_LOG',
    'CLEAR_ADGUARD_LOG',
    'SET_CURRENT_SITE_PROTECTION'
  ]) {
    assert.match(background, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('build discovers AdGuard filters and emits a filter catalog', () => {
  const build = readText('scripts/build.mjs');

  assert.match(build, /discoverFilterCatalog/);
  assert.match(build, /catalog\.json/);
  assert.match(build, /filters_i18n\.json/);
  assert.match(build, /MAX_STATIC_RULESETS|100/);
  assert.match(build, /recommended/);
  assert.match(build, /ManifestPatcher/);
  assert.doesNotMatch(build, /const filterIds = \['2'\]/);
});

test('blocking page and Assistant bundle are packaged safely', () => {
  assertProjectFile('blocking-page.html');
  assertProjectFile('blocking-page.css');
  assertProjectFile('blocking-page.js');
  assertProjectFile('src/adguard-assistant.js');

  const blockingPage = readText('blocking-page.js');
  const assistantEntry = readText('src/adguard-assistant.js');
  const build = readText('scripts/build.mjs');

  assert.match(blockingPage, /URLSearchParams/);
  assert.match(blockingPage, /textContent/);
  assert.doesNotMatch(blockingPage, /innerHTML/);
  assert.match(assistantEntry, /@adguard\/api-mv3\/assistant/);
  assert.match(build, /adguard-assistant/);
  assert.match(build, /blocking-page\.html/);
  assert.match(build, /blocking-page\.css/);
  assert.match(build, /blocking-page\.js/);
});

test('README and release notes document v1.2.0 presets and fallback distribution', () => {
  const readme = readText('README.md');
  const releaseNotes = readText('RELEASE_NOTES.md');

  assert.match(readme, /YouTube Segments/);
  assert.match(readme, /AdGuard tab/);
  assert.match(readme, /allowlist/i);
  assert.match(readme, /user rules/i);
  assert.match(readme, /request log/i);
  assert.match(readme, /DNS/i);
  assert.doesNotMatch(readme, /YouTube-only ad blocking/);
  assert.match(readme, /Minimal/);
  assert.match(readme, /Recommended/);
  assert.match(readme, /Strict/);
  assert.match(readme, /Custom/);
  assert.match(readme, /2, 3, 17, 105/);
  assert.match(readme, /native-like/i);
  assert.match(readme, /GitHub Release ZIP/i);

  assert.match(releaseNotes, /v1\.2\.0/);
  assert.match(releaseNotes, /Minimal/);
  assert.match(releaseNotes, /Recommended/);
  assert.match(releaseNotes, /Strict/);
  assert.match(releaseNotes, /Custom/);
  assert.match(releaseNotes, /2, 3, 17, 105/);
  assert.match(releaseNotes, /skip button/i);
  assert.match(releaseNotes, /GitHub Release ZIP/i);
});
