# Two-Tab YouTube Segments and AdGuard Dashboard Design

## Goal

Turn the extension popup into a two-tab control center:

1. `YouTube Segments` for the existing YouTube segment skipping features.
2. `AdGuard` for the complete set of practical browser-side controls exposed by the currently used AdGuard MV3 stack.

The extension stays our own product. SponsorBlock branding is removed from primary UI copy, while required and honest third-party attribution remains in README, NOTICE, credits, and source documentation.

The repository name and URL remain unchanged in this update because renaming the GitHub repository is not required to achieve the requested two-section product structure.

## Product naming

Popup tabs:

- `YouTube Segments`
- `AdGuard`

Main extension display name remains `YT Segments & Sponsor Autoskipper` for this release to avoid changing install identity and public links as part of the same large functional update. The popup itself no longer presents `SponsorBlock` as the feature name. Instead, it uses product-owned language such as `YouTube Segments`, `Segment behavior`, and `Segment skipping`.

Third-party attribution must continue to state that segment data is provided by SponsorBlock and filtering technology is provided by AdGuard.

## Architecture

Keep one Chrome Manifest V3 extension and one popup shell. Split popup behavior into two independently understandable modules instead of growing one monolithic `popup.js`.

Suggested boundaries:

- `lib/settings.js`: persisted settings schema and sanitization.
- `lib/adblock-config.js`: convert persisted AdGuard settings into `@adguard/api-mv3` configuration.
- `lib/adguard-filters.js`: packaged filter catalog metadata and selected filter validation.
- `src/background.js`: AdGuard runtime lifecycle, configuration changes, Assistant integration, request logging, and message handling.
- `popup.js`: shell and tab switching only.
- `popup-youtube.js`: YouTube Segments tab behavior.
- `popup-adguard.js`: AdGuard tab behavior.
- `popup.html`: two tab panels and accessible tab navigation.
- `popup.css`: shared theme plus tab-specific sections.

No unrelated rewrite of the existing segment-skipping content script is part of this update.

## Tab 1: YouTube Segments

This tab contains the existing segment functionality:

- master segment skipping toggle,
- per-category modes: `Auto skip`, `Show button`, `Ignore`,
- timeline markers,
- skip notices,
- current dark, light, and system theme control if a global settings area is not introduced,
- reset segment defaults.

The user-facing tab must not label the functionality itself as `SponsorBlock`. SponsorBlock remains visible only in attribution/help copy.

## Tab 2: AdGuard

### Protection

Provide:

- master protection toggle,
- current filtering state,
- global scope by default,
- Advanced `Global` versus `YouTube only` scope selector,
- current-site protection toggle implemented through the allowlist when global scope is active,
- explicit status text showing whether the current page is protected,
- `Stop engine` and `Start engine` diagnostic controls only in an Advanced/Diagnostics disclosure, using `adguardApi.stop()` and `adguardApi.start()` safely.

Stopping the engine is different from merely setting `filteringEnabled: false`; the UI must explain the distinction.

### Filter lists

Use filter identifiers provided by the packaged `@adguard/dnr-rulesets` metadata instead of hard-coding only AdGuard Base filter ID `2`.

At build time:

- load the current Chromium MV3 DNR assets,
- read their filter metadata,
- generate a compact filter catalog JSON used by the popup,
- declare as many supported static rulesets as Chromium permits,
- enable a conservative recommended default set,
- keep the remaining declared rulesets disabled until the user enables them.

The UI groups available filters by the metadata shipped with the ruleset package where possible. User-facing groups should include categories such as:

- Ad blocking,
- Privacy / tracking protection,
- URL tracking,
- Social widgets,
- Annoyances,
- Cookie notices,
- Popups,
- Mobile app banners,
- Widgets / other annoyances,
- Security or malicious URL lists where included by the packaged Chromium rulesets,
- Language-specific filters,
- Other packaged filters.

Do not invent a filter that is not present in the current build metadata.

The UI must show:

- enabled filter count,
- loaded rule count,
- Chromium static ruleset quota information,
- a clear error if enabling a filter would exceed the runtime ruleset/rule quota.

The browser supports a finite number of static rulesets. The implementation must honor the browser-reported limits rather than silently failing.

### Allowlist

Expose the AdGuard API `allowlist` configuration as a proper editor:

- add domain,
- remove domain,
- normalize hostnames,
- reject invalid entries,
- import newline-separated domains,
- export/copy current entries,
- one-click add/remove current site.

When `YouTube only` scope is selected, the API `blocklist` scope takes precedence and the UI must explain that global allowlist behavior is not active because AdGuard is already restricted to the YouTube blocklist.

### Custom user rules

Expose the AdGuard API `rules` configuration:

- multiline rule editor,
- save/apply,
- reset user rules,
- import text,
- export/copy text,
- rule count,
- preserve the previous valid rules if reconfiguration fails.

Rules are treated as AdGuard filtering syntax. The UI must not claim that every rule type can execute arbitrary JavaScript. MV3 script-rule restrictions remain enforced.

### AdGuard Assistant

Add a `Block element on this page` button.

Flow:

1. resolve the active tab,
2. call `adguardApi.openAssistant(tabId)`,
3. subscribe to `onAssistantCreateRule`,
4. append the newly created rule to persisted custom rules,
5. reconfigure the engine,
6. show the created rule in the user rules editor,
7. expose a close/cancel path through `adguardApi.closeAssistant(tabId)`.

Assistant failure must not break normal filtering.

### Request log

Use `adguardApi.onRequestBlocked` to maintain a bounded local log of blocked requests.

Show:

- timestamp,
- request URL,
- referrer when available,
- request type,
- assumed filter ID when available,
- company category when available,
- current tab versus all tabs filter,
- clear log button.

Deduplicate events using `requestId` because the AdGuard API can emit more than one event for the same blocked request.

Do not persist unlimited browsing history. Keep the log bounded and local. Default retention should be in-memory or a small capped session structure, not synced browser storage.

### Statistics and diagnostics

Show:

- `adguardApi.getRulesCount()`,
- enabled filter count,
- blocked request count for the current session,
- current scope,
- current-site protection state,
- available static rule capacity from Chromium where accessible,
- selected filter IDs,
- custom rule count,
- allowlist count,
- engine running/stopped state,
- last successful configuration time,
- last configuration error when present.

A diagnostics action may copy a sanitized diagnostic report. It must not include full browsing history by default.

### Document blocking page

Use `documentBlockingPageUrl` from the AdGuard API.

Add a local extension page that can display:

- the blocked destination,
- the triggering rule,
- filter ID,
- a safe `Go back` action,
- an optional `Allow this site` action that adds the site to the allowlist after explicit user input.

All query-string values must be treated as untrusted text and escaped before rendering.

## Filters and Manifest V3 limits

The build may package multiple AdGuard static DNR rulesets, but Chromium imposes ruleset and rule quotas. The implementation must:

- use the current `@adguard/dnr-rulesets` metadata,
- never assume every known AdGuard filter can be simultaneously enabled,
- check available rule capacity before applying large filter changes when possible,
- surface quota errors to the user,
- keep safe defaults after update,
- preserve filter selections across normal browser sessions,
- reconcile selections after extension updates because static ruleset availability can change between builds.

## DNS boundary

Do not add fake DNS, DNS-over-HTTPS, DNS-over-TLS, DNSCrypt, AdGuard Home, parental control, or operating-system network settings to this browser extension.

Those features belong to AdGuard DNS, AdGuard Home, or native AdGuard products and are not exposed by `@adguard/api-mv3` as browser-extension configuration.

The AdGuard tab may include a small informational note stating that DNS-level protection requires a separate DNS/native product, but it must not present an inert DNS selector.

## Permissions

Add only permissions needed by implemented browser functionality.

Likely additions for the full browser-side experience include:

- `contextMenus` if context actions are added,
- `userScripts` only if the implementation actually uses custom UserScripts functionality,
- current `storage`, `tabs`, `webRequest`, `webNavigation`, `unlimitedStorage`, `scripting`, `declarativeNetRequest`, and `declarativeNetRequestFeedback` permissions remain where needed.

Do not request a permission merely because the official AdGuard extension uses it. Every permission must map to a feature implemented in this repository.

## Data model

Extend persisted settings with a nested AdGuard model instead of adding many unrelated top-level fields.

Conceptual shape:

```text
settings: {
  youtube: {
    enabled,
    showMarkers,
    showToast,
    categories
  },
  adguard: {
    enabled,
    scope,
    filterIds,
    allowlist,
    rules
  },
  theme
}
```

Migration must preserve existing users' settings from v1.0.1:

- `enabled` becomes `youtube.enabled`,
- `adBlockEnabled` becomes `adguard.enabled`,
- `adBlockScope` becomes `adguard.scope`,
- existing category modes are preserved,
- theme is preserved,
- missing AdGuard filter selection gets the recommended default set.

Migration must be idempotent and safe for malformed stored data.

## UI behavior

Use exactly two top-level tabs. Do not add a third Settings tab.

AdGuard tab may contain expandable subsections:

- Protection,
- Filters,
- Allowlist,
- User rules,
- Request log,
- Statistics,
- Advanced / diagnostics.

Persist the last selected tab locally so reopening the popup returns to the user's previous view.

Keep popup dimensions practical. Long editors and request logs should scroll inside the popup rather than making the entire browser popup excessively tall.

## Error handling

Any failed AdGuard reconfiguration must:

1. retain the last known good configuration,
2. show a visible error in the AdGuard tab,
3. record a diagnostic error message,
4. leave YouTube segment skipping operational.

Invalid filter IDs, malformed domain entries, and invalid stored settings are sanitized rather than crashing the service worker.

## Testing

Add tests for:

- v1.0.1 settings migration,
- two-tab popup contract,
- SponsorBlock branding removal from primary UI,
- attribution retention,
- filter catalog generation,
- filter ID validation,
- default filter selection,
- Chromium ruleset quota failure handling,
- allowlist normalization,
- current-site allow/unallow behavior,
- custom rule persistence,
- Assistant-created rule persistence,
- request-event deduplication,
- bounded request log retention,
- document blocking page escaping,
- AdGuard config rollback on failure,
- global versus YouTube-only scope,
- build still emits `background.js`, `adguard-content.js`, filter assets, manifest, and popup assets,
- release ZIP root layout.

## Release

Ship this as a feature release rather than another patch because the popup architecture and settings model materially expand.

Target version: `1.1.0`.

The existing CI and release workflows remain mandatory. Release must be merged through a PR after tests, build, package, and archive verification pass.

## Verified external constraints

Current design is based on:

- `@adguard/api-mv3` 2.0.1 public API and Configuration model,
- `@adguard/dnr-rulesets` current Chromium MV3 packaging model,
- Chromium Manifest V3 declarativeNetRequest runtime limits,
- the official AdGuard Browser Extension permission and feature model.

DNS-level products are deliberately excluded because they are separate from the browser MV3 API used by this repository.
