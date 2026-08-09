# YT Segments & Sponsor Autoskipper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a production-ready Chrome MV3 extension combining SponsorBlock segment skipping with optional AdGuard-backed YouTube ad blocking, polished branding, tests, and automated GitHub releases.

**Architecture:** Keep SponsorBlock skipping as the existing small plain-JavaScript subsystem. Add an AdGuard MV3 subsystem behind a dedicated settings boundary, bundle its runtime code and rulesets at build time, and keep popup state in `chrome.storage.sync`. Produce a deterministic `dist/extension` directory and release ZIP from that directory.

**Tech Stack:** Chrome Manifest V3, plain HTML/CSS/JavaScript, Node.js 22, Node test runner, esbuild, `@adguard/api-mv3`, `@adguard/dnr-rulesets`, `@adguard/tswebextension`, GitHub Actions.

## Global Constraints

- Repository: `Majkey25/yt-segments-sponsorship-autoskipper`.
- Public repository with `main` as default branch.
- GPL-3.0-only distribution because bundled AdGuard dependencies are GPL-3.0-only.
- No telemetry, analytics, accounts, or remotely executed JavaScript/WASM.
- SponsorBlock queries use the existing privacy-preserving hash-prefix API client.
- Theme choices: `system`, `dark`, `light`.
- Release ZIP must contain `manifest.json` directly at archive root.

---

### Task 1: Settings contract and regression coverage

**Files:**
- Modify: `lib/settings.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Produces: `sanitizeSettings()` with `adBlockEnabled` and `theme` fields.
- Produces: `THEMES = ['system', 'dark', 'light']`.

- [ ] Add failing tests proving invalid themes fall back to `system`, valid themes persist, and ad blocking defaults to enabled.
- [ ] Run `npm test` and confirm the new assertions fail before implementation.
- [ ] Add the minimal settings validation implementation.
- [ ] Run `npm test` and confirm all settings and existing SponsorBlock tests pass.

### Task 2: AdGuard integration and build pipeline

**Files:**
- Create: `src/adguard-background.js`
- Create: `src/adguard-content.js`
- Create: `scripts/build.mjs`
- Create: `tests/build.test.js`
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `background.js`

**Interfaces:**
- `src/adguard-background.js` starts AdGuard with `filters: [2]`, `assetsPath: 'filters'`, `blocklist: ['youtube.com', 'www.youtube.com', 'music.youtube.com']`, and the stored `adBlockEnabled` setting.
- Build outputs `dist/extension/vendor/adguard-background.js`, `dist/extension/vendor/adguard-content.js`, AdGuard assets, and the extension source files.

- [ ] Add a failing build test that requires release manifest permissions, AdGuard entry files, icons, and `manifest.json` at the build root.
- [ ] Run the focused build test and confirm it fails before build implementation exists.
- [ ] Add build dependencies and a deterministic build script that bundles runtime code, fetches current AdGuard MV3 assets, patches the built manifest for the selected filter, and copies only release files.
- [ ] Wire the background service worker and content scripts to the generated AdGuard bundles.
- [ ] Run `npm run build` and `npm test`.

### Task 3: Popup redesign and accessibility

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Create: `tests/popup.test.js`

**Interfaces:**
- Popup persists `enabled`, `adBlockEnabled`, `showMarkers`, `showToast`, `theme`, and segment category modes to `chrome.storage.sync`.

- [ ] Add static tests for required popup controls and accessible labels.
- [ ] Run tests and confirm failure against the old popup.
- [ ] Implement the compact black/white/red UI, dedicated ad-blocking toggle, three-state segment controls, and theme selector.
- [ ] Re-run tests and syntax checks.

### Task 4: Branding and repository documentation

**Files:**
- Create: `icons/icon.svg`
- Create: `icons/icon16.png`
- Create: `icons/icon32.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`
- Create: `assets/banner.svg`
- Create: `assets/preview.svg`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Modify: `NOTICE.md`
- Modify: `README.md`
- Create: `RELEASE_NOTES.md`

**Interfaces:**
- Manifest references PNG icons at 16/32/48/128 sizes.
- README release links target `Majkey25/yt-segments-sponsorship-autoskipper`.

- [ ] Create a simple original skip/timeline/play icon in black, white, and YouTube-red, then rasterize required sizes.
- [ ] Create matching banner and popup-preview SVG assets.
- [ ] Document install, permissions, privacy, SponsorBlock attribution, AdGuard GPL attribution, limitations, development, and releases.
- [ ] Verify all referenced files exist and SVG/XML parses.

### Task 5: CI, release automation, and filter refresh

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/refresh-adguard.yml`

**Interfaces:**
- CI runs `npm ci`, `npm test`, and `npm run build`.
- Release creates `yt-segments-sponsorship-autoskipper.zip` and `yt-segments-sponsorship-autoskipper-vX.Y.Z.zip`.
- Refresh workflow checks the latest `@adguard/dnr-rulesets` dependency on a schedule and opens/commits an automated dependency update only when needed, which then causes a fresh release build after merge.

- [ ] Add workflows mirroring the proven release pattern from `tab-copy-extension` while building from `dist/extension`.
- [ ] Validate YAML syntax and inspect archive root locally.

### Task 6: Final verification and GitHub publication

**Files:**
- Verify all project files.

**Interfaces:**
- Public repository and release become the canonical distribution source.

- [ ] Run fresh `npm test`.
- [ ] Run fresh `npm run build`.
- [ ] Run JavaScript syntax checks and verify manifest JSON.
- [ ] Verify release ZIP root contains `manifest.json`.
- [ ] Initialize git with `main`, commit the full project, create the public GitHub repository, push `main`, and confirm Actions succeeds.
- [ ] Confirm release `v1.0.0` exists with both ZIP assets.
