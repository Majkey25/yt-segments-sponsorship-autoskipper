# YT Segments & Sponsor Autoskipper v1.0.1

Global ad-block scope update.

## Changes

- Ad Block now defaults to global filtering across websites.
- Advanced settings can restrict AdGuard filtering to YouTube only.
- SponsorBlock remains YouTube specific.
- Existing missing or invalid scope settings safely fall back to Global.
- The AdGuard content runtime now loads globally while SponsorBlock scripts remain limited to YouTube.
- Package and manifest versions are aligned at `1.0.1`.

## Installation

1. Download `yt-segments-sponsorship-autoskipper.zip` from this release.
2. Extract the archive to a permanent folder.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the extracted folder that directly contains `manifest.json` and `adguard-content.js`.

Use the release asset ZIP, not GitHub's automatically generated source archive.
