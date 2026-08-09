# Contributing

Small, focused pull requests are welcome.

## Setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Run `npm test`.
4. Run `npm run build`.

The unpacked extension is generated in `dist/extension`.

## Rules

- Keep changes focused.
- Do not add telemetry, analytics, accounts, or remote executable code.
- Keep the ad blocker scoped to YouTube.
- Add or update tests for behavior changes.
- Run `npm test` before opening a pull request.
- Do not commit `node_modules`, `.build`, or `dist`.

## Releases

The GitHub Actions release workflow builds fresh AdGuard MV3 rules, tests the project, packages the extension, and publishes release ZIP files.