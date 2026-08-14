# Contributing

Small, focused pull requests are welcome.

## Setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Run `npm test`.
4. Run `npm run build`.

The unpacked extension is generated in `dist/extension`.

## Rules

- Keep the extension limited to YouTube segment skipping.
- Do not add analytics, telemetry, accounts, remote executable code, or broad host access.
- Add or update tests for behavior changes.
- Run `npm test`, `npm run build`, and `npm run package` before opening a pull request.
- Do not commit `node_modules` or `dist`.

## Releases

GitHub Actions tests the project, builds the static extension, and publishes stable and versioned release ZIP files.
