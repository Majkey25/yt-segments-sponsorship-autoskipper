# AdGuard Presets and Native Skip Button Design

## Goal

Ship a focused v1.2.0 update that improves AdGuard defaults and makes the manual YouTube segment skip control feel native to the YouTube player, while preserving all existing v1.1.0 behavior and the current GitHub Release ZIP fallback distribution path.

## AdGuard presets

Add four preset states to the AdGuard tab:

- Minimal: filter ID 2 only.
- Recommended: filter IDs 2, 3, 17, 105. This is the new default for new or reset settings.
- Strict: filter IDs 2, 3, 17, 18, 19, 20, 21, 22, 105.
- Custom: shown automatically when the selected filter IDs do not exactly match one of the three named presets.

Existing users keep their saved filter selection. The new Recommended preset must not silently overwrite an existing custom or older saved selection during migration.

The preset selector applies its filter list through the same AdGuard settings pipeline already used by manual filter checkboxes. Manual checkbox edits remain available and update the preset label to Custom when appropriate.

## Inline documentation

Add a compact explanation under the preset selector:

- Minimal: core ad blocking with the smallest ruleset footprint.
- Recommended: balanced ads, tracking protection, URL tracking cleanup, and Czech/Slovak site coverage.
- Strict: Recommended plus annoyance filters for cookie notices, popups, mobile app banners, miscellaneous annoyances, and widgets. It may break more sites.
- Custom: user-selected filters.

README and release notes should document the preset behavior and clarify that Recommended is the default for new/reset configurations.

## YouTube manual skip button

Replace the current colored-border custom button styling with a YouTube-native-like control that remains owned by this extension and does not depend on private YouTube CSS classes.

Behavior remains unchanged: the button appears only for segment categories configured in button mode and skips to the segment end when clicked.

Visual requirements:

- Place at the lower-right of the player above native controls, including fullscreen adjustments.
- Dark translucent background with a subtle neutral border.
- White Roboto-style text using the existing `Skip <category>` label.
- Add a small inline skip/next icon to the right of the text.
- Remove the category-colored border from the button.
- Preserve keyboard focus visibility and existing click behavior.
- Avoid copying YouTube private DOM internals or relying on unstable YouTube class names beyond the existing player container placement.

## Version and release

Bump the extension to v1.2.0. Keep the existing GitHub Release ZIP packaging and release workflow functional as the fallback install path. Chrome Web Store distribution is a separate follow-up and must not replace or remove the current fallback path in this change.

## Testing

Add or update tests to verify:

- Recommended default filter IDs are 2, 3, 17, 105.
- Minimal, Recommended, and Strict preset definitions are correct.
- Preset detection returns Custom for arbitrary selections.
- Existing saved filter selections survive settings sanitization and migration.
- Popup markup exposes the preset control and helper text.
- Content CSS no longer uses the segment color for the skip button border and includes the native-like button structure/style contract.
- Existing v1.1.0 tests remain green.
- Build and release packaging still produce the complete unpacked extension ZIP.

## Non-goals

- Do not add DNS resolver controls.
- Do not change SponsorBlock API behavior.
- Do not remove GitHub Release ZIP distribution.
- Do not implement Chrome Web Store API publishing in this update.
