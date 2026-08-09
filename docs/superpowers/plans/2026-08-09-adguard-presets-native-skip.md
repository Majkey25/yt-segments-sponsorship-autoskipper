# AdGuard Presets and Native Skip Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release v1.2.0 with Minimal, Recommended, Strict, and Custom AdGuard preset handling, a Recommended default of filters 2, 3, 17, and 105, and a YouTube-native-like manual segment skip button.

**Architecture:** Keep the existing v1.1.0 settings and AdGuard runtime architecture. Put preset definitions and preset detection in `lib/adguard-filters.js`, keep persisted settings as filter ID arrays, and let the popup translate between presets and the existing `APPLY_ADGUARD_SETTINGS` path. Restyle and minimally extend the existing content-script button DOM without depending on private YouTube control classes.

**Tech Stack:** Chrome Manifest V3, JavaScript, Node.js built-in test runner, `@adguard/api-mv3`, `@adguard/dnr-rulesets`, webpack/build scripts already present in the repository.

## Global Constraints

- Version target is `1.2.0`.
- Minimal preset is `[2]`.
- Recommended preset is `[2, 3, 17, 105]` and is the default for new or reset settings.
- Strict preset is `[2, 3, 17, 18, 19, 20, 21, 22, 105]`.
- Custom is detected when selected filter IDs do not exactly match a named preset.
- Existing saved filter selections must survive settings sanitization and migration unchanged.
- Existing GitHub Release ZIP packaging remains functional as fallback distribution.
- No DNS resolver controls or Chrome Web Store publishing are part of this release.
- Manual skip behavior is unchanged; only DOM structure and styling change.

---

### Task 1: AdGuard preset model and default migration safety

**Files:**
- Modify: `lib/settings.js`
- Modify: `lib/adguard-filters.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Produces: `PRESET_FILTER_IDS`, `presetForFilterIds(ids)`, `filterIdsForPreset(name)`, and `RECOMMENDED_FILTER_IDS` equal to `[2, 3, 17, 105]`.
- Existing `sanitizeSettings(input)` continues to preserve an explicitly saved `adguard.filterIds` array.

- [ ] **Step 1: Write failing tests for the new defaults and preset helpers**

Add assertions equivalent to:

```js
assert.deepEqual(Settings.RECOMMENDED_FILTER_IDS, [2, 3, 17, 105]);
assert.deepEqual(AdguardFilters.filterIdsForPreset('minimal'), [2]);
assert.deepEqual(AdguardFilters.filterIdsForPreset('recommended'), [2, 3, 17, 105]);
assert.deepEqual(AdguardFilters.filterIdsForPreset('strict'), [2, 3, 17, 18, 19, 20, 21, 22, 105]);
assert.equal(AdguardFilters.presetForFilterIds([2]), 'minimal');
assert.equal(AdguardFilters.presetForFilterIds([105, 17, 3, 2]), 'recommended');
assert.equal(AdguardFilters.presetForFilterIds([2, 18]), 'custom');
assert.deepEqual(
  Settings.sanitizeSettings({ adguard: { filterIds: [2, 18] } }).adguard.filterIds,
  [2, 18]
);
```

- [ ] **Step 2: Run `npm test` and verify RED**

Expected failures: old recommended list is `[2, 3, 17]` and preset helpers do not exist.

- [ ] **Step 3: Implement preset constants and helper functions**

Use immutable arrays, normalize integer arrays before comparison, return copies from `filterIdsForPreset`, and return `custom` for unknown or unmatched selections.

- [ ] **Step 4: Change the settings fallback default only**

Set the settings module recommended fallback to `[2, 3, 17, 105]` while preserving explicit stored arrays. Do not overwrite existing saved filter IDs during migration.

- [ ] **Step 5: Run `npm test` and verify GREEN for core tests**

- [ ] **Step 6: Commit**

Commit message: `feat: add AdGuard filter presets`

---

### Task 2: AdGuard preset selector and inline documentation

**Files:**
- Modify: `popup.html`
- Modify: `popup-adguard.js`
- Modify: `popup.css`
- Test: `tests/project.test.js`

**Interfaces:**
- Consumes: `AdguardFilters.presetForFilterIds(ids)` and `AdguardFilters.filterIdsForPreset(name)` from Task 1.
- Produces: popup control IDs `filterPreset` and `filterPresetHelp`.

- [ ] **Step 1: Write failing popup contract tests**

Assert that `popup.html` contains:

```html
<select id="filterPreset">
```

and options for `minimal`, `recommended`, `strict`, and `custom`, plus helper element `id="filterPresetHelp"`.

Assert `popup-adguard.js` references both preset helper functions and applies preset changes through the existing AdGuard settings application path.

- [ ] **Step 2: Run `npm test` and verify RED**

- [ ] **Step 3: Add the preset selector above filter search**

Use copy:

```text
Minimal — Core ad blocking with the smallest ruleset footprint.
Recommended — Balanced ads, tracking protection, URL tracking cleanup, and Czech/Slovak coverage.
Strict — Recommended plus cookie notices, popups, mobile app banners, other annoyances, and widgets. May break more sites.
Custom — Your manually selected filter combination.
```

Disable selecting `custom` as an action-only preset; it is a detected state.

- [ ] **Step 4: Wire preset changes and manual filter detection**

On named preset selection, resolve IDs with `filterIdsForPreset`, validate that those IDs exist in the packaged catalog, apply through `applyAdguard`, and rerender. On manual checkbox edits, derive the displayed selector state using `presetForFilterIds`.

- [ ] **Step 5: Style the compact preset row and helper text**

Reuse current popup visual language and keep the Filters section readable without introducing a new top-level section.

- [ ] **Step 6: Run `npm test` and verify GREEN**

- [ ] **Step 7: Commit**

Commit message: `feat: add AdGuard preset controls`

---

### Task 3: YouTube-native-like manual skip button

**Files:**
- Modify: `content.js`
- Modify: `content.css`
- Test: `tests/project.test.js`

**Interfaces:**
- Existing `showSkipButton(segment)` and `skipSegment(segment, automatic)` behavior remains unchanged.
- Button DOM gains child elements for text and icon but keeps class `majkey-segment-skip-button`.

- [ ] **Step 1: Write failing style and DOM contract tests**

Assert that `content.js` creates separate text and icon child elements for the skip button, and `content.css` no longer uses `var(--segment-color)` as the button border.

Assert CSS contains a neutral translucent background, neutral border, white text, right-side placement, hover state, focus-visible state, and fullscreen bottom adjustment.

- [ ] **Step 2: Run `npm test` and verify RED**

- [ ] **Step 3: Change button DOM creation minimally**

Create a text span and an icon span once when the button is created. Update only the text span for each active segment. Use a simple inline skip/next glyph built from CSS or safe text, not an external image and not YouTube private markup.

- [ ] **Step 4: Restyle the button**

Use YouTube-like dimensions and typography: dark translucent background, subtle neutral border, white Roboto/Arial text, compact horizontal layout, hover lightening, visible keyboard focus. Remove category color state from the button.

- [ ] **Step 5: Run `npm test` and verify GREEN**

- [ ] **Step 6: Commit**

Commit message: `feat: make segment skip button feel native`

---

### Task 4: Version, docs, release notes, and final verification

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `tests/project.test.js`

**Interfaces:**
- Package and manifest versions must both be `1.2.0`.
- Existing build/package workflow and release ZIP names remain unchanged.

- [ ] **Step 1: Update project tests to require v1.2.0 and preset documentation**

Change the version test to `1.2.0`. Require README and release notes to mention Minimal, Recommended, Strict, the Recommended default, and the native-like manual skip button.

- [ ] **Step 2: Run `npm test` and verify RED**

- [ ] **Step 3: Bump manifest and package version to 1.2.0**

Do not change extension permissions, install identity, or fallback packaging paths.

- [ ] **Step 4: Update README and release notes**

Document the three named presets, automatic Custom detection, preservation of existing saved filter selections, and the redesigned manual skip control. Keep existing GitHub Release ZIP installation instructions intact.

- [ ] **Step 5: Run full verification**

Run in order:

```text
npm test
npm run build
npm run package
```

Expected: all tests pass; build emits background, AdGuard content, Assistant, blocking page, filter catalog, popup assets, and segment content assets; package emits stable and versioned v1.2.0 ZIPs with `manifest.json` at archive root.

- [ ] **Step 6: Commit**

Commit message: `chore: prepare v1.2.0`

- [ ] **Step 7: Open PR to `main`, wait for green CI, then squash merge**

Use exact expected head SHA when merging so a changed branch cannot be merged accidentally.

- [ ] **Step 8: Verify post-merge CI and release**

Confirm `main` CI succeeds and release workflow publishes `v1.2.0` with both fallback ZIP assets.
