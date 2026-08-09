# Two-Tab YouTube Segments and AdGuard Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.1.0 with a two-tab popup containing the existing YouTube segment controls and a full browser-side AdGuard control center backed by `@adguard/api-mv3` 2.0.1 and the packaged AdGuard DNR rulesets.

**Architecture:** Migrate the flat v1.0.1 settings model into nested `youtube` and `adguard` settings, keep pure validation helpers in `lib/`, and make `src/background.js` the only owner of the live AdGuard API instance. Generate a packaged filter catalog during the existing build, split popup behavior into shell, YouTube, and AdGuard modules, and expose all runtime operations through explicit Chrome runtime messages.

**Tech Stack:** Chrome Manifest V3, JavaScript, Node.js 22 test runner, `@adguard/api-mv3` 2.0.1, `@adguard/dnr-rulesets`, webpack, GitHub Actions.

## Global Constraints

- Use exactly two top-level popup tabs: `YouTube Segments` and `AdGuard`.
- Remove SponsorBlock as the primary feature label in the popup, but keep SponsorBlock attribution in credits, README, NOTICE, and source documentation.
- Keep SponsorBlock fetching and segment execution limited to YouTube.
- AdGuard scope defaults to `global` and may be changed to `youtube`.
- Expose every practical public `@adguard/api-mv3` 2.0.1 runtime function: `start`, `stop`, `configure`, `openAssistant`, `closeAssistant`, `getRulesCount`, `onAssistantCreateRule`, and `onRequestBlocked`.
- Support the public Configuration fields: `filters`, `filteringEnabled`, `assetsPath`, `allowlist`, `blocklist`, `rules`, and `documentBlockingPageUrl`.
- Do not add fake DNS, DoH, DoT, DNSCrypt, AdGuard Home, parental control, or operating-system network controls.
- Package all Chromium MV3 AdGuard filters that the current `@adguard/dnr-rulesets` build can declare without exceeding Chrome's static ruleset manifest limit.
- Never enable more static rulesets than Chrome reports as supported. Surface quota errors instead of silently ignoring them.
- Request log stays bounded and in-memory. Do not sync browsing history.
- Preserve the last known good AdGuard configuration if a reconfiguration fails.
- Target release version is `1.1.0` in both `manifest.json` and `package.json`.
- All code comments remain concise English.

---

### Task 1: Migrate settings to nested YouTube and AdGuard models

**Files:**
- Modify: `lib/settings.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Produces `SegmentSettings.DEFAULT_SETTINGS` with `{ youtube, adguard, theme }`.
- Produces `SegmentSettings.sanitizeSettings(input)` that accepts both v1.0.1 flat settings and v1.1 nested settings.
- Produces `SegmentSettings.activeCategories(settings)` reading `settings.youtube.categories`.

- [ ] **Step 1: Add failing migration tests**

Add tests that assert:

```js
const migrated = Settings.sanitizeSettings({
  enabled: false,
  adBlockEnabled: true,
  adBlockScope: 'youtube',
  showMarkers: false,
  showToast: true,
  theme: 'light',
  categories: { sponsor: 'button' }
});

assert.equal(migrated.youtube.enabled, false);
assert.equal(migrated.youtube.showMarkers, false);
assert.equal(migrated.youtube.categories.sponsor, 'button');
assert.equal(migrated.adguard.enabled, true);
assert.equal(migrated.adguard.scope, 'youtube');
assert.deepEqual(migrated.adguard.filterIds, [2, 3, 17]);
assert.deepEqual(migrated.adguard.allowlist, []);
assert.deepEqual(migrated.adguard.rules, []);
assert.equal(migrated.theme, 'light');
```

Also test malformed nested input, duplicate/invalid filter IDs, duplicate domains, invalid scope, non-string rules, and idempotent sanitization.

- [ ] **Step 2: Run `node --test tests/core.test.js` and verify RED**

Expected: migration assertions fail because the current model is flat.

- [ ] **Step 3: Implement the nested model**

Use exact defaults:

```js
const RECOMMENDED_FILTER_IDS = Object.freeze([2, 3, 17]);

const DEFAULT_SETTINGS = Object.freeze({
  youtube: Object.freeze({
    enabled: true,
    showMarkers: true,
    showToast: true,
    categories: Object.freeze(/* existing category defaults */)
  }),
  adguard: Object.freeze({
    enabled: true,
    scope: 'global',
    filterIds: RECOMMENDED_FILTER_IDS,
    allowlist: Object.freeze([]),
    rules: Object.freeze([])
  }),
  theme: 'system'
});
```

`sanitizeSettings()` must detect old flat keys and map them into the nested model before validating. Filter IDs are positive integers, deduplicated, and sorted. Allowlist and rules accept arrays only at this layer; domain syntax validation is Task 2.

- [ ] **Step 4: Update `activeCategories()` to read nested settings**

- [ ] **Step 5: Run core tests and verify GREEN**

- [ ] **Step 6: Commit**

Commit message: `feat: migrate settings for dashboard`

---

### Task 2: Add pure AdGuard domain, filter, and request-log helpers

**Files:**
- Create: `lib/adguard-utils.js`
- Create: `lib/adguard-filters.js`
- Test: `tests/core.test.js`

**Interfaces:**
- `AdguardUtils.normalizeHostname(value): string | null`
- `AdguardUtils.parseDomainList(text): string[]`
- `AdguardUtils.mergeBlockedRequest(log, event, limit = 200): object[]`
- `AdguardFilters.sanitizeFilterIds(ids, catalog): number[]`
- `AdguardFilters.groupCatalog(catalog): Map-like object`
- `AdguardFilters.defaultFilterIds(catalog): number[]`

- [ ] **Step 1: Add failing tests for hostname normalization**

Cover raw domains, URLs, mixed case, ports, trailing dots, duplicates, empty values, unsupported protocols, and invalid hostnames.

Required examples:

```js
assert.equal(AdguardUtils.normalizeHostname('HTTPS://Example.COM:443/path'), 'example.com');
assert.equal(AdguardUtils.normalizeHostname('sub.example.com.'), 'sub.example.com');
assert.equal(AdguardUtils.normalizeHostname('javascript:alert(1)'), null);
assert.deepEqual(
  AdguardUtils.parseDomainList('Example.com\nhttps://example.com/x\nsub.example.com'),
  ['example.com', 'sub.example.com']
);
```

- [ ] **Step 2: Add failing tests for request-event dedupe and retention**

Two events with the same `requestId` must merge into one row, preferring later defined `companyCategoryName`, `assumedFilterId`, and other useful fields. A log over the limit removes oldest entries.

- [ ] **Step 3: Add failing filter-catalog tests**

Catalog validation must reject IDs absent from the generated catalog. Default IDs are the intersection of `[2, 3, 17]` and available IDs.

- [ ] **Step 4: Run core tests and verify RED**

- [ ] **Step 5: Implement the two pure helper modules**

Do not use Chrome globals in these files so Node tests remain deterministic.

- [ ] **Step 6: Run core tests and verify GREEN**

- [ ] **Step 7: Commit**

Commit message: `feat: add AdGuard dashboard helpers`

---

### Task 3: Generate and package the complete available filter catalog

**Files:**
- Modify: `scripts/build.mjs`
- Create during build: `dist/extension/filters/catalog.json`
- Test: `tests/project.test.js`

**Interfaces:**
- Build discovers `ruleset_<id>` assets under `.build/filters/declarative`.
- Manifest declares at most 100 discovered static rulesets.
- `filters/catalog.json` contains the exact declared filter IDs and best available display metadata.
- Recommended enabled rulesets are the available subset of IDs `2`, `3`, and `17`.

- [ ] **Step 1: Add failing build-contract tests**

The build script must no longer hard-code only `filterIds = ['2']`. Tests should assert it discovers ruleset IDs, writes `filters/catalog.json`, passes discovered IDs to `ManifestPatcher`, and uses an explicit recommended default list.

- [ ] **Step 2: Run project tests and verify RED**

- [ ] **Step 3: Implement `discoverFilterCatalog()` in `scripts/build.mjs`**

After `loader.load(filtersDir)`, enumerate only numeric `ruleset_<id>` directories/files, exclude special metadata ruleset `0`, sort numeric IDs, and cap at Chrome's 100 static-ruleset manifest limit.

Read `filters_i18n.json` defensively. If a metadata name is unavailable, use `Filter <id>` rather than failing the build. Store compact JSON entries:

```json
{
  "generatedAt": "ISO timestamp",
  "filters": [
    { "id": 2, "name": "AdGuard Base filter", "description": "...", "group": "Ad blocking" }
  ]
}
```

- [ ] **Step 4: Patch manifest with every discovered ID**

Pass `ids: discoveredIds.map(String)` and `enabled: recommendedIds.map(String)` to `ManifestPatcher`.

Keep `excludeUnsafeRules` after patching and keep the `4900` unsafe-rule safety limit.

- [ ] **Step 5: Copy the generated catalog with the filter assets**

The existing recursive copy from `.build/filters` to `dist/extension/filters` should include it automatically.

- [ ] **Step 6: Run project tests**

- [ ] **Step 7: Commit**

Commit message: `feat: package AdGuard filter catalog`

---

### Task 4: Expand AdGuard configuration and service-worker runtime

**Files:**
- Modify: `lib/adblock-config.js`
- Modify: `src/background.js`
- Test: `tests/core.test.js`
- Test: `tests/project.test.js`

**Interfaces:**
- `AdblockConfig.createAdguardConfiguration(adguardSettings, options)` returns the full public API Configuration.
- Background runtime messages:
  - `GET_ADGUARD_STATE`
  - `APPLY_ADGUARD_SETTINGS`
  - `START_ADGUARD`
  - `STOP_ADGUARD`
  - `OPEN_ADGUARD_ASSISTANT`
  - `CLOSE_ADGUARD_ASSISTANT`
  - `GET_ADGUARD_LOG`
  - `CLEAR_ADGUARD_LOG`
  - `SET_CURRENT_SITE_PROTECTION`
- Background replies always use `{ ok: boolean, ... }` and include a useful error string on failure.

- [ ] **Step 1: Replace boolean/scope config tests with full-configuration failing tests**

Required behavior:

```js
const config = AdblockConfig.createAdguardConfiguration({
  enabled: true,
  scope: 'global',
  filterIds: [2, 3, 17],
  allowlist: ['example.com'],
  rules: ['example.org##.ad']
}, { documentBlockingPageUrl: 'chrome-extension://id/blocking-page.html' });

assert.deepEqual(config.filters, [2, 3, 17]);
assert.deepEqual(config.allowlist, ['example.com']);
assert.deepEqual(config.rules, ['example.org##.ad']);
assert.equal(config.documentBlockingPageUrl, 'chrome-extension://id/blocking-page.html');
assert.equal(config.blocklist, undefined);
```

YouTube scope must set the existing YouTube blocklist and omit `allowlist` because the API ignores allowlist when blocklist is set.

- [ ] **Step 2: Add project tests for the explicit runtime message names and event subscriptions**

Assert background source contains `getRulesCount`, `onAssistantCreateRule.subscribe`, `onRequestBlocked.addListener`, `openAssistant`, `closeAssistant`, `start`, `stop`, and `configure`.

- [ ] **Step 3: Run tests and verify RED**

- [ ] **Step 4: Implement full configuration construction**

`createAdguardConfiguration()` validates only already-sanitized values and clones arrays before passing them into the library.

- [ ] **Step 5: Implement last-known-good runtime state**

Track:

```js
let adguardApi = null;
let adguardMessageHandler = null;
let adguardRunning = false;
let lastAppliedSettings = null;
let lastConfiguredAt = null;
let lastConfigurationError = null;
const blockedRequests = [];
```

On `configure()` failure, keep persisted settings unchanged and keep `lastAppliedSettings` unchanged.

- [ ] **Step 6: Subscribe to Assistant-created rules**

When a new rule arrives, load the current settings, append only a non-empty unique string rule, attempt configuration, and persist the updated settings only after configuration succeeds.

- [ ] **Step 7: Subscribe to blocked request events**

Use `AdguardUtils.mergeBlockedRequest(blockedRequests, event, 200)`. Do not write this log to sync/local storage.

- [ ] **Step 8: Implement status/diagnostics state**

`GET_ADGUARD_STATE` returns sanitized settings plus engine state, rules count, blocked session count, last configuration timestamp/error, current tab ID/hostname, current-site protection state, enabled static ruleset IDs from `chrome.declarativeNetRequest.getEnabledRulesets()`, available static rule count, and Chrome ruleset constants when present.

- [ ] **Step 9: Implement apply/start/stop and current-site protection**

`APPLY_ADGUARD_SETTINGS` sanitizes the proposed nested settings, applies them, and persists only on success. Current-site protection adds/removes the normalized active hostname from the allowlist only in global scope. In YouTube-only scope return an explanatory error instead of mutating the allowlist.

- [ ] **Step 10: Implement Assistant open/close operations**

Resolve the active tab ID server-side. Reject missing tab IDs or restricted extension/browser URLs with a clear error.

- [ ] **Step 11: Run tests and verify GREEN**

- [ ] **Step 12: Commit**

Commit message: `feat: expose AdGuard runtime controls`

---

### Task 5: Build the two-tab popup and split frontend responsibilities

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Replace: `popup.js`
- Create: `popup-youtube.js`
- Create: `popup-adguard.js`
- Test: `tests/project.test.js`

**Interfaces:**
- `popup.js` owns tab switching, theme, shared status, and last-tab persistence in `chrome.storage.local` key `popupTab`.
- `popup-youtube.js` owns only `settings.youtube` controls.
- `popup-adguard.js` owns only AdGuard controls and background messaging.

- [ ] **Step 1: Add failing two-tab DOM contract tests**

Require exactly two top-level tab buttons with `role="tab"`, IDs `youtubeTab` and `adguardTab`, and panels `youtubePanel` and `adguardPanel`.

Assert primary UI does not contain a section label named `SponsorBlock`; credits may still contain the word.

- [ ] **Step 2: Add failing AdGuard control contract tests**

Require controls/containers for:

- protection toggle,
- Global / YouTube only scope,
- current-site protection,
- filter search and filter list,
- enabled/rules quota counters,
- allowlist editor,
- user rules editor,
- Assistant open/close,
- request log and clear button,
- statistics/diagnostics,
- start/stop engine controls,
- visible DNS boundary note.

- [ ] **Step 3: Run project tests and verify RED**

- [ ] **Step 4: Replace popup shell with two accessible tabs**

Use ARIA tab semantics and keyboard Left/Right navigation. Keep the existing dark/light/system theme system.

- [ ] **Step 5: Move YouTube segment controls to `popup-youtube.js`**

Keep behavior unchanged except nested settings paths and product-owned labels.

- [ ] **Step 6: Implement AdGuard protection controls**

Load `GET_ADGUARD_STATE`, render engine/filtering/scope/current-site status, and send complete sanitized AdGuard settings through `APPLY_ADGUARD_SETTINGS`.

- [ ] **Step 7: Implement filter list UI**

Fetch `filters/catalog.json`, group by catalog group, support text search, render checkbox rows, and refuse changes that would exceed the browser-reported enabled-ruleset limit before sending them to background.

- [ ] **Step 8: Implement allowlist editor**

Textarea supports one domain per line. Normalize locally with `AdguardUtils.parseDomainList()` and apply via the background. Add `Add current site`, `Protect current site`, and `Copy` actions.

- [ ] **Step 9: Implement user-rules editor**

One rule per line with Apply, Reset, and Copy actions. Never execute raw JavaScript from popup code. The AdGuard API remains responsible for MV3 rule validation.

- [ ] **Step 10: Implement Assistant, log, statistics, and diagnostics**

Assistant buttons call open/close messages. Request log refreshes on demand and while the popup is open using a modest timer, displays only the latest 200 in-memory rows, and supports Current tab / All tabs. Diagnostics copy a sanitized text report without request URLs.

- [ ] **Step 11: Add clear inline errors and success state**

No `alert()` calls. Use a single status region with `role="status"` / `aria-live="polite"`.

- [ ] **Step 12: Run project tests and verify GREEN**

- [ ] **Step 13: Commit**

Commit message: `feat: add YouTube and AdGuard tabs`

---

### Task 6: Add document blocking page and Assistant bundle support

**Files:**
- Create: `blocking-page.html`
- Create: `blocking-page.css`
- Create: `blocking-page.js`
- Create: `src/adguard-assistant.js`
- Modify: `scripts/build.mjs`
- Modify: `manifest.json`
- Modify: `tests/project.test.js`

**Interfaces:**
- `src/adguard-assistant.js` imports `@adguard/api-mv3/assistant` as the dedicated Assistant entry bundle.
- Build emits `adguard-assistant.js`.
- Blocking page uses only `textContent` for query-derived values.

- [ ] **Step 1: Add failing contracts for blocking page and assistant bundle**

Assert build webpack entries include `adguard-assistant`, static copy includes all three blocking-page files, and blocking-page JS uses `URLSearchParams` plus `textContent` and contains no `innerHTML`.

- [ ] **Step 2: Run project tests and verify RED**

- [ ] **Step 3: Add Assistant entry**

```js
import '@adguard/api-mv3/assistant';
```

Bundle it alongside `background` and `adguard-content`.

- [ ] **Step 4: Add safe blocking page**

Read `url`, `rule`, and `filterId`. Parse blocked URL using `new URL()`, allow navigation only for `http:` and `https:`, render all values via text nodes/textContent, provide `Go back`, and provide `Allow this site` only for a valid hostname.

`Allow this site` sends `SET_CURRENT_SITE_PROTECTION` with explicit hostname/protected=false or a dedicated background message that shares the same allowlist validation path.

- [ ] **Step 5: Wire `documentBlockingPageUrl`**

Background config uses `chrome.runtime.getURL('blocking-page.html')`.

- [ ] **Step 6: Update manifest and release version**

Set `manifest.version = 1.1.0`. Keep `<all_urls>` and existing AdGuard permissions. Add no new permission unless implementation actually requires it.

- [ ] **Step 7: Run project tests**

- [ ] **Step 8: Commit**

Commit message: `feat: add AdGuard blocking tools`

---

### Task 7: Update public docs, preview assets, and release metadata

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `NOTICE.md` only if attribution wording needs clarification
- Modify: `assets/banner.svg`
- Modify: `assets/preview.svg`
- Test: `tests/project.test.js`

**Interfaces:**
- Both package and manifest version are `1.1.0`.
- Public docs describe two tabs and the DNS boundary accurately.

- [ ] **Step 1: Add/adjust version and public-copy contract tests**

Require package/manifest version equality and absence of stale `YouTube-only ad blocking` claims.

- [ ] **Step 2: Run tests and verify RED where applicable**

- [ ] **Step 3: Update package metadata and release notes**

Release notes must cover settings migration, two tabs, filters, allowlist, user rules, Assistant, request log, diagnostics, blocking page, and no DNS controls.

- [ ] **Step 4: Update README**

Document the two-tab workflow, filter quota behavior, current-site toggle, Assistant, local request log, user rules, and why DNS is not in this browser extension.

- [ ] **Step 5: Update banner/preview**

Replace stale `Block YouTube ads` messaging with `Global AdGuard protection` and visually show the two tabs without copying official AdGuard artwork.

- [ ] **Step 6: Run project tests and verify GREEN**

- [ ] **Step 7: Commit**

Commit message: `docs: document AdGuard dashboard`

---

### Task 8: Full verification, PR, merge, and v1.1.0 release

**Files:**
- Verify all changed files
- Verify `.github/workflows/ci.yml`
- Verify `.github/workflows/release.yml`

- [ ] **Step 1: Run full unit/contract suite**

Run `npm test` and require zero failures.

- [ ] **Step 2: Build with the current AdGuard filter package**

Run `npm run build` and require exit code 0.

- [ ] **Step 3: Verify generated outputs**

Require:

```text
dist/extension/manifest.json
dist/extension/background.js
dist/extension/adguard-content.js
dist/extension/adguard-assistant.js
dist/extension/blocking-page.html
dist/extension/filters/catalog.json
```

Verify built manifest declares more than one AdGuard ruleset and never more than 100.

- [ ] **Step 4: Package release**

Run `npm run package` and verify both stable and `v1.1.0` ZIPs contain `manifest.json` at archive root.

- [ ] **Step 5: Review branch diff against `main`**

Only the approved dashboard feature, its tests, docs, build updates, spec, and plan may be present.

- [ ] **Step 6: Open PR to `main`**

PR title: `feat: add two-tab AdGuard dashboard`

- [ ] **Step 7: Wait for `test-build` to pass**

Inspect failed logs if needed. Do not merge red CI.

- [ ] **Step 8: Merge PR**

Use squash merge after CI success.

- [ ] **Step 9: Verify post-merge `main` CI**

Require successful test, build, package, and archive verification.

- [ ] **Step 10: Verify Release extension workflow**

Require successful `v1.1.0` creation and both assets:

```text
yt-segments-sponsorship-autoskipper.zip
yt-segments-sponsorship-autoskipper-v1.1.0.zip
```

- [ ] **Step 11: Verify published release metadata**

Release must be published, non-draft, non-prerelease, target the merge commit, and use `RELEASE_NOTES.md` content.
