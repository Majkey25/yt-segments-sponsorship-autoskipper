# YouTube Skipper v2.0.0

A focused new major release.

## Changed

- Renamed the product and repository to **YouTube Skipper**.
- Removed the entire browser ad-filtering feature, engine, dashboard, dependencies, rulesets, global host access, and related permissions.
- Reduced the runtime to SponsorBlock segment skipping on supported YouTube pages.
- Replaced the mixed worker with a small bounded SponsorBlock request/cache worker.
- Simplified the popup to segment modes, markers, notices, theme, and reset controls.
- Replaced the build with a static reproducible package containing no filtering engine.
- Updated artwork, badges, documentation, archive names, and release automation.

## Preserved

- Automatic and manual segment skipping.
- Per-category modes.
- Timeline markers and skip notices.
- Native-like manual skip control.
- Privacy-preserving SponsorBlock hash-prefix lookups.

## Install

Download `youtube-skipper.zip`, extract it, and load the extracted folder through `chrome://extensions` in Developer mode.
