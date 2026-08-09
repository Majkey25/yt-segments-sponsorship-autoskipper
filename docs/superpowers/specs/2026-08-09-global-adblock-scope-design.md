# Global Ad Block Scope Design

## Goal

Make Ad Block operate globally across all websites by default, while preserving an Advanced setting that can restrict AdGuard filtering to YouTube only.

## User experience

The main popup shows Ad Block as a global feature when enabled.

Default state:

- Ad Block enabled according to the existing setting.
- Ad Block scope defaults to `global`.
- Status text clearly says `Scope: Global`.
- Supporting copy explains that ads are blocked across all websites using AdGuard filters.

Advanced settings expose one scope control with two values:

- `Global` applies AdGuard filtering to all sites covered by the extension host permissions.
- `YouTube only` restricts AdGuard filtering to YouTube, YouTube Music, mobile YouTube, and YouTube embedded domains.

SponsorBlock behavior remains YouTube only and is independent from the ad block scope.

## Settings model

Add a persisted setting:

```text
adBlockScope: "global"
```

Allowed values are `global` and `youtube`.

Settings sanitization must fall back to `global` for missing or invalid values so existing users receive the new global default after updating.

## AdGuard configuration

`createAdguardConfiguration(enabled, scope)` remains the single boundary for producing AdGuard MV3 configuration.

For `global`:

- Keep AdGuard Base filter enabled.
- Set `filteringEnabled` from the existing ad block toggle.
- Do not provide a YouTube blocklist restriction.

For `youtube`:

- Keep AdGuard Base filter enabled.
- Set `filteringEnabled` from the existing ad block toggle.
- Use the existing YouTube domain blocklist restriction.

Changing either the enabled state or scope must reconfigure the already initialized AdGuard runtime without requiring an extension reload.

## Popup behavior

The main Ad Block section shows:

- existing enable or disable control,
- current scope label,
- global explanatory copy when the scope is global,
- YouTube only explanatory copy when the scope is YouTube only.

Advanced settings contain the scope selector. The selector must save immediately through the existing settings persistence path and update the AdGuard runtime through the current storage change listener.

Do not add site allowlists, custom domain lists, per tab controls, or additional filter list selectors in this change.

## Manifest and permissions

Keep the existing `<all_urls>` host permission and AdGuard MV3 permissions because global filtering requires them.

The generated AdGuard content script must run on all relevant pages required by the global filtering engine rather than being restricted to YouTube matches. SponsorBlock content scripts remain restricted to YouTube domains.

## Documentation

Update README and release notes to state that:

- Ad blocking is global by default.
- Advanced settings can restrict it to YouTube only.
- SponsorBlock remains YouTube specific.
- Broad host permission is required for global filtering.

Remove wording that describes the blocker as YouTube only by default.

## Testing

Add or update tests to verify:

1. `adBlockScope` defaults to `global`.
2. invalid scope values sanitize to `global`.
3. global AdGuard configuration has no YouTube blocklist restriction.
4. YouTube scope includes the expected YouTube blocklist.
5. disabling Ad Block still disables filtering for either scope.
6. popup settings contract includes the advanced scope selector.
7. manifest contract allows AdGuard content filtering globally while SponsorBlock scripts remain YouTube scoped.
8. release build still generates `background.js` and `adguard-content.js` and packages `manifest.json` at ZIP root.

## Release

Ship this as the next patch release after `v1.0.0` because it changes default filtering behavior but not the extension data model in a breaking way.

The release workflow must rebuild with fresh AdGuard rules, run the complete test suite, verify archive layout, and publish stable and versioned ZIP assets.

## Failure handling

If AdGuard initialization or reconfiguration fails, log the failure and leave SponsorBlock segment skipping operational.

An invalid stored scope must never prevent the extension from starting because it is normalized to `global` before AdGuard configuration is created.
