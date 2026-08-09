# YT Segments & Sponsor Autoskipper v1.1.0

Two-tab control center update.

## Highlights

- The popup now has exactly two top-level sections: **YouTube Segments** and **AdGuard**.
- SponsorBlock is no longer used as the primary feature label in the popup. Attribution remains in credits and project notices.
- Existing v1.0.1 settings migrate automatically into the new nested YouTube and AdGuard settings model.

## AdGuard dashboard

- Global filtering remains the default, with **YouTube only** available as an alternate scope.
- The build now discovers and packages the available Chromium MV3 AdGuard rulesets instead of declaring only the Base filter.
- Filter selection UI shows enabled filter count, loaded rule count, and Chrome ruleset quota information.
- Added editable allowlist with current-site protection controls.
- Added custom user rules editor.
- Added AdGuard Assistant element blocker with created-rule persistence.
- Added bounded in-memory blocked request log with current-tab and all-tabs views.
- Added engine start and stop controls plus sanitized diagnostics.
- Added local document blocking page support for `$document` filtering rules.
- Failed AdGuard reconfiguration keeps the last known good applied configuration.

## YouTube Segments

- Existing automatic and manual segment behavior remains available.
- Timeline markers, skip notices, per-category modes, and safe defaults are preserved.
- Segment fetching remains YouTube-specific.

## DNS

DNS-level features such as AdGuard DNS, AdGuard Home, DNS-over-HTTPS, DNS-over-TLS, and DNSCrypt are not exposed because they are not browser controls provided by `@adguard/api-mv3`.

## Installation

1. Download `yt-segments-sponsorship-autoskipper.zip` from this release.
2. Extract the archive to a permanent folder.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the extracted folder that directly contains `manifest.json`, `background.js`, and `adguard-content.js`.

Use the release asset ZIP, not GitHub's automatically generated source archive.
