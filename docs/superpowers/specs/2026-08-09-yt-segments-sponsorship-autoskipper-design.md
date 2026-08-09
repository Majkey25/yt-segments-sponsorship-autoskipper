# YT Segments & Sponsor Autoskipper Design

## Goal

Ship a public Chrome Manifest V3 extension that combines SponsorBlock-powered segment skipping with an optional YouTube-focused ad-blocking layer, polished black/white/red UI, reproducible tests, and GitHub Release automation modeled after `Majkey25/tab-copy-extension`.

## Product behavior

- SponsorBlock segments remain independently configurable as `Auto skip`, `Show button`, or `Ignore`.
- Sponsors and self-promotion auto-skip by default.
- Intro, outro, interaction, preview, hook, and non-music segments show a manual skip button by default.
- Segment markers remain visible on the YouTube seek bar when enabled.
- Ad blocking is a separate master toggle and is enabled by default.
- The popup supports dark, light, and system themes.
- No telemetry, analytics, accounts, or remote executable code.

## Ad-blocking architecture

Use AdGuard's maintained Manifest V3 stack rather than inventing a custom filter engine. Build-time automation bundles current AdGuard MV3 assets and code so the extension stays compatible with Chrome's remote-code policy. GitHub Actions periodically checks for newer AdGuard ruleset packages and publishes refreshed release archives.

The extension must not promise permanent YouTube ad blocking. YouTube can change ad delivery and Manifest V3 imposes technical limits. The project will document this honestly and keep the update path automated.

## Licensing

Because the release bundles GPL-3.0-only AdGuard components and rulesets, the repository is GPL-3.0-only. SponsorBlock data/API attribution is retained separately in `NOTICE.md`.

## UI direction

Visual thesis: a compact YouTube-adjacent utility surface using near-black and white as the base, YouTube red as the only strong accent, crisp typography, thin separators, and no decorative card grid.

Content plan: brand header and master state, ad-blocking control, segment behavior list, display preferences, theme selector, reset action, project and SponsorBlock attribution.

Interaction thesis: fast toggle transitions, clear three-state segment controls, and restrained theme transitions. Accessibility requires visible keyboard focus, readable contrast, and native form semantics.

## Repository and releases

Repository name: `yt-segments-sponsorship-autoskipper`.

The repository includes README, banner, popup preview, icons, GPL license, contribution guide, release notes, tests, build scripts, and GitHub Actions. Releases provide both a stable filename and a versioned filename with `manifest.json` at archive root.
