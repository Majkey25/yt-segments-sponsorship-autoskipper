# YT Segments & Sponsor Autoskipper v1.2.0

AdGuard preset and player control update.

## AdGuard presets

- Added **Minimal**, **Recommended**, and **Strict** filter presets.
- **Recommended** is the default for new configurations and settings restored to defaults, using filter IDs `2, 3, 17, 105` for AdGuard Base, Tracking Protection, URL Tracking, and Czech/Slovak coverage.
- **Minimal** uses filter ID `2` for the smallest core ad blocking ruleset footprint.
- **Strict** uses filter IDs `2, 3, 17, 18, 19, 20, 21, 22, 105` and adds cookie notices, popups, mobile app banners, other annoyances, and widgets.
- **Custom** is detected automatically when manually selected filter IDs do not exactly match a named preset.
- Existing saved filter selections are preserved during update and are not silently replaced by the new Recommended default.
- Presets are validated against the packaged filter catalog before application.

## YouTube Segments

- Redesigned the manual segment **skip button** with a native-like YouTube player appearance.
- The button now uses neutral player styling and an inline skip icon instead of a category-colored border.
- Existing skip behavior, automatic skipping, segment categories, timeline markers, and skip notices remain unchanged.

## Distribution

- The existing **GitHub Release ZIP** remains fully supported as the fallback installation and update path.
- Both stable and versioned release archives continue to be produced by the release workflow.
- Chrome Web Store distribution is not part of this release and does not replace the existing fallback.

## Existing AdGuard controls

Global filtering, YouTube-only scope, current-site protection, the allowlist, custom user rules, AdGuard Assistant, request log, diagnostics, and document blocking remain available from the AdGuard tab.

## DNS

DNS-level features such as AdGuard DNS, AdGuard Home, DNS-over-HTTPS, DNS-over-TLS, and DNSCrypt are not exposed because they are not browser controls provided by `@adguard/api-mv3`.

## Fallback installation

1. Download `yt-segments-sponsorship-autoskipper.zip` from this release.
2. Extract the archive to a permanent folder.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the extracted folder that directly contains `manifest.json`, `background.js`, and `adguard-content.js`.

Use the release asset ZIP, not GitHub's automatically generated source archive.
