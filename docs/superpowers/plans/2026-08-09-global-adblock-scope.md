# Global Ad Block Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AdGuard blocking global across all websites by default, while allowing users to switch the blocker to YouTube-only scope from Advanced settings.

**Architecture:** Keep `lib/adblock-config.js` as the single scope-to-AdGuard configuration boundary. Persist `adBlockScope` through the existing `SegmentSettings` object, let `src/background.js` reconfigure the existing AdGuard runtime whenever storage changes, and expand only the AdGuard content script manifest match pattern to global URLs while leaving SponsorBlock scripts YouTube-only.

**Tech Stack:** Chrome Manifest V3, JavaScript, `@adguard/api-mv3`, `@adguard/dnr-rulesets`, Node.js 22 test runner, GitHub Actions.

## Global Constraints

- `adBlockScope` has exactly two valid values: `global` and `youtube`.
- Default and invalid fallback value is `global`.
- SponsorBlock remains YouTube-only.
- Global Ad Block uses the existing AdGuard Base filter ID `2`.
- Do not add allowlists, custom site lists, per-tab controls, or extra filter selectors.
- Changing scope must take effect through the existing storage change listener without requiring an extension reload.
- Keep the existing `<all_urls>` host permission and AdGuard MV3 permissions.
- Ship as patch release `1.0.1`.

---

### Task 1: Persist and validate the ad block scope

**Files:**
- Modify: `lib/settings.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Produces: `SegmentSettings.AD_BLOCK_SCOPES` with `['global', 'youtube']`.
- Produces: `SegmentSettings.DEFAULT_SETTINGS.adBlockScope === 'global'`.
- Produces: `SegmentSettings.sanitizeSettings(input).adBlockScope` always equal to `global` or `youtube`.

- [ ] **Step 1: Write failing settings tests**

Add assertions equivalent to:

```js
test('sanitizeSettings defaults ad blocking scope to global', () => {
  const settings = Settings.sanitizeSettings({});
  assert.equal(settings.adBlockScope, 'global');
  assert.equal(Settings.DEFAULT_SETTINGS.adBlockScope, 'global');
  assert.deepEqual(Settings.AD_BLOCK_SCOPES, ['global', 'youtube']);
});

test('sanitizeSettings accepts YouTube scope and rejects unknown scope', () => {
  assert.equal(Settings.sanitizeSettings({ adBlockScope: 'youtube' }).adBlockScope, 'youtube');
  assert.equal(Settings.sanitizeSettings({ adBlockScope: 'everywhere' }).adBlockScope, 'global');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test tests/core.test.js
```

Expected: the new assertions fail because `adBlockScope` and `AD_BLOCK_SCOPES` do not exist yet.

- [ ] **Step 3: Implement the minimal settings model**

In `lib/settings.js`, add:

```js
const AD_BLOCK_SCOPES = ['global', 'youtube'];
```

Extend defaults:

```js
adBlockEnabled: true,
adBlockScope: 'global',
```

Extend sanitized output:

```js
adBlockScope: AD_BLOCK_SCOPES.includes(source.adBlockScope)
  ? source.adBlockScope
  : DEFAULT_SETTINGS.adBlockScope,
```

Export `AD_BLOCK_SCOPES` with the existing API object.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
node --test tests/core.test.js
```

Expected: all core tests pass.

- [ ] **Step 5: Commit the settings change**

Commit message:

```text
feat: add ad block scope setting
```

---

### Task 2: Make AdGuard configuration global by default

**Files:**
- Modify: `lib/adblock-config.js`
- Modify: `src/background.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Consumes: `settings.adBlockScope` from Task 1.
- Produces: `AdblockConfig.createAdguardConfiguration(enabled, scope)`.
- Global scope produces no `blocklist` property.
- YouTube scope produces `blocklist: [...YOUTUBE_BLOCKLIST]`.

- [ ] **Step 1: Replace the YouTube-only config tests with scope-specific failing tests**

Use tests equivalent to:

```js
test('AdGuard configuration is global by default', () => {
  const configuration = AdblockConfig.createAdguardConfiguration(true, 'global');
  assert.deepEqual(configuration.filters, [2]);
  assert.equal(configuration.filteringEnabled, true);
  assert.equal(configuration.assetsPath, 'filters');
  assert.equal(configuration.blocklist, undefined);
});

test('AdGuard configuration can be restricted to YouTube', () => {
  const configuration = AdblockConfig.createAdguardConfiguration(true, 'youtube');
  assert.deepEqual(configuration.blocklist, AdblockConfig.YOUTUBE_BLOCKLIST);
});

test('AdGuard disabled state preserves selected scope semantics', () => {
  const globalConfig = AdblockConfig.createAdguardConfiguration(false, 'global');
  const youtubeConfig = AdblockConfig.createAdguardConfiguration(false, 'youtube');
  assert.equal(globalConfig.filteringEnabled, false);
  assert.equal(globalConfig.blocklist, undefined);
  assert.equal(youtubeConfig.filteringEnabled, false);
  assert.deepEqual(youtubeConfig.blocklist, AdblockConfig.YOUTUBE_BLOCKLIST);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
node --test tests/core.test.js
```

Expected: the global config test fails because the current implementation always supplies a YouTube blocklist.

- [ ] **Step 3: Implement scope-aware configuration**

Change the configuration boundary to:

```js
function createAdguardConfiguration(enabled, scope = 'global') {
  const configuration = {
    filters: [...FILTER_IDS],
    filteringEnabled: Boolean(enabled),
    assetsPath: 'filters'
  };

  if (scope === 'youtube') {
    configuration.blocklist = [...YOUTUBE_BLOCKLIST];
  }

  return configuration;
}
```

Do not introduce other scope values here. Settings sanitization already guarantees a valid value.

- [ ] **Step 4: Pass scope into AdGuard startup and reconfiguration**

In `src/background.js`, change the storage change path from a boolean-only update to settings-based configuration:

```js
const settings = SegmentSettings.sanitizeSettings(changes.settings.newValue);
void updateAdguard(settings.adBlockEnabled, settings.adBlockScope);
```

Startup must call:

```js
await adguardApi.start(
  AdblockConfig.createAdguardConfiguration(settings.adBlockEnabled, settings.adBlockScope)
);
```

Update function signature and configure call:

```js
async function updateAdguard(enabled, scope) {
  await adguardReady;
  if (!adguardApi) {
    return;
  }

  try {
    await adguardApi.configure(AdblockConfig.createAdguardConfiguration(enabled, scope));
  } catch (error) {
    console.error('[YT Autoskipper] Failed to update ad blocking', error);
  }
}
```

- [ ] **Step 5: Run core tests**

Run:

```bash
node --test tests/core.test.js
```

Expected: all core tests pass.

- [ ] **Step 6: Commit the AdGuard scope implementation**

Commit message:

```text
feat: support global ad blocking
```

---

### Task 3: Add Advanced scope control and global status copy

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Test: `tests/project.test.js`

**Interfaces:**
- Consumes: `settings.adBlockScope` from Task 1.
- Produces DOM IDs: `adBlockScope`, `adBlockScopeStatus`, `adBlockScopeCopy`, and `advancedToggle`.
- Saves through the existing `chrome.storage.sync.set({ settings })` path.

- [ ] **Step 1: Add failing popup contract tests**

Extend `tests/project.test.js` with checks equivalent to:

```js
test('popup exposes global ad block status and advanced scope selector', () => {
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');

  assert.match(html, /id="adBlockScopeStatus"/);
  assert.match(html, /id="advancedToggle"/);
  assert.match(html, /id="adBlockScope"/);
  assert.match(html, /value="global"/);
  assert.match(html, /value="youtube"/);
  assert.match(script, /settings\.adBlockScope/);
});
```

- [ ] **Step 2: Run project tests and verify failure**

Run:

```bash
node --test tests/project.test.js
```

Expected: new popup contract test fails because the advanced controls do not exist.

- [ ] **Step 3: Update the Protection copy**

Change the static section note from `YouTube only` to a dynamic element:

```html
<span id="adBlockScopeStatus" class="section-note">Global</span>
```

Change Ad Block supporting copy to a dynamic element:

```html
<small id="adBlockScopeCopy">Blocks ads across all websites using AdGuard filters</small>
```

- [ ] **Step 4: Add a compact Advanced disclosure**

Below the basic Protection controls add:

```html
<details class="advanced" id="advancedSettings">
  <summary id="advancedToggle">Advanced settings</summary>
  <div class="option-row advanced-row">
    <label for="adBlockScope">Ad blocking scope</label>
    <select id="adBlockScope" aria-label="Ad blocking scope">
      <option value="global">Global</option>
      <option value="youtube">YouTube only</option>
    </select>
  </div>
</details>
```

Keep the UI compact and aligned with the existing black, white, red visual system.

- [ ] **Step 5: Wire the scope selector into popup persistence**

Add:

```js
const adBlockScopeInput = document.getElementById('adBlockScope');
const adBlockScopeStatus = document.getElementById('adBlockScopeStatus');
const adBlockScopeCopy = document.getElementById('adBlockScopeCopy');
```

Register `change` with `saveFromControls`.

In `render()`:

```js
adBlockScopeInput.value = settings.adBlockScope;
renderAdBlockScope();
```

Include scope in sanitation input:

```js
adBlockScope: adBlockScopeInput.value,
```

Add one focused renderer:

```js
function renderAdBlockScope() {
  const globalScope = settings.adBlockScope === 'global';
  adBlockScopeStatus.textContent = globalScope ? 'Global' : 'YouTube only';
  adBlockScopeCopy.textContent = globalScope
    ? 'Blocks ads across all websites using AdGuard filters'
    : 'AdGuard filtering is restricted to YouTube';
}
```

Call it after settings changes as part of normal rendering.

- [ ] **Step 6: Add minimal Advanced styles**

Add styles for `.advanced`, `.advanced summary`, and `.advanced-row` using existing `--line`, `--muted`, `--surface-hover`, and `--accent` variables. Do not add another card container or new color system.

- [ ] **Step 7: Run project tests**

Run:

```bash
node --test tests/project.test.js
```

Expected: project tests pass.

- [ ] **Step 8: Commit the popup change**

Commit message:

```text
feat: add advanced ad block scope control
```

---

### Task 4: Run the AdGuard content runtime globally while keeping SponsorBlock scoped

**Files:**
- Modify: `manifest.json`
- Test: `tests/project.test.js`

**Interfaces:**
- AdGuard content script match scope: `<all_urls>`.
- SponsorBlock content script match scope remains the existing YouTube URL list.

- [ ] **Step 1: Add failing manifest scope assertions**

Extend the existing manifest content-script test:

```js
assert.deepEqual(adguardScript.matches, ['<all_urls>']);
assert.ok(segmentScript.matches.every((pattern) => pattern.includes('youtube.com')));
```

Also ensure the segment script does not contain `<all_urls>`.

- [ ] **Step 2: Run project tests and verify failure**

Run:

```bash
node --test tests/project.test.js
```

Expected: the AdGuard match assertion fails because it is still YouTube scoped.

- [ ] **Step 3: Change only the AdGuard content-script match list**

Set the first `content_scripts` entry to:

```json
"matches": ["<all_urls>"]
```

Keep `all_frames`, `match_about_blank`, and `run_at: "document_start"` unchanged.

Do not alter SponsorBlock `content.js` matches.

- [ ] **Step 4: Update manifest description and version**

Set version to:

```json
"version": "1.0.1"
```

Use description:

```text
Skip SponsorBlock segments on YouTube and block ads globally with AdGuard MV3 rules.
```

- [ ] **Step 5: Run project tests**

Run:

```bash
node --test tests/project.test.js
```

Expected: all project contract tests pass.

- [ ] **Step 6: Commit manifest scope and version**

Commit message:

```text
feat: enable global filtering runtime
```

---

### Task 5: Update public documentation and release notes

**Files:**
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`

**Interfaces:**
- Documentation must describe Global as the default scope.
- Documentation must describe YouTube only as the Advanced alternative.
- SponsorBlock must still be described as YouTube specific.

- [ ] **Step 1: Update README feature and architecture wording**

Replace claims such as `YouTube-only ad blocking` and `focused on YouTube` with precise global behavior.

README must state:

```text
Ad Block is global by default and applies AdGuard filtering across websites covered by the extension permissions.
```

And:

```text
Advanced settings can restrict Ad Block to YouTube only without changing SponsorBlock behavior.
```

Keep the existing disclosure explaining why `<all_urls>` permission exists.

- [ ] **Step 2: Update the release notes for v1.0.1**

Make the release heading `YT Segments & Sponsor Autoskipper v1.0.1` and include:

```text
- Ad Block now defaults to global filtering across websites.
- Advanced settings can restrict filtering to YouTube only.
- SponsorBlock remains YouTube specific.
- Existing invalid or missing scope settings safely fall back to Global.
```

- [ ] **Step 3: Commit docs**

Commit message:

```text
docs: document global ad blocking
```

---

### Task 6: Full verification and release

**Files:**
- Verify: `tests/*.test.js`
- Verify: `scripts/build.mjs`
- Verify: `scripts/package.mjs`
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/release.yml`

**Interfaces:**
- Built extension must contain `manifest.json`, `background.js`, and `adguard-content.js`.
- Release ZIP must contain `manifest.json` at archive root.
- Release tag must be `v1.0.1`.

- [ ] **Step 1: Run the complete Node test suite**

Run:

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Build the extension**

Run:

```bash
npm run build
```

Expected: exit code 0 and `dist/extension/` contains the generated AdGuard runtime.

- [ ] **Step 3: Package the extension**

Run:

```bash
npm run package
```

Expected: stable and versioned release ZIPs are created under `dist/release/`.

- [ ] **Step 4: Verify built runtime and archive root**

Run checks equivalent to:

```bash
test -f dist/extension/manifest.json
test -f dist/extension/background.js
test -f dist/extension/adguard-content.js
unzip -Z1 dist/release/yt-segments-sponsorship-autoskipper.zip | grep -Fx 'manifest.json'
```

Expected: every command exits 0.

- [ ] **Step 5: Inspect the feature branch diff against `main`**

Confirm only the approved scope feature, tests, docs, version, spec, and plan files changed. Do not include unrelated changes.

- [ ] **Step 6: Publish through the existing protected-main workflow**

Open one PR from `feat/global-adblock-scope` to `main`, wait for the `test-build` CI status, and merge only after the configured repository protection requirements are satisfied.

- [ ] **Step 7: Verify the release workflow**

After merge, confirm the Release extension workflow completes successfully and publishes `v1.0.1` with both:

```text
yt-segments-sponsorship-autoskipper.zip
yt-segments-sponsorship-autoskipper-v1.0.1.zip
```

- [ ] **Step 8: Verify the published release metadata**

Confirm the release is not draft or prerelease, both assets are uploaded, and the release notes mention the global default plus YouTube-only Advanced scope.
