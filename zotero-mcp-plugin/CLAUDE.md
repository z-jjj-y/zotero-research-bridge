# Zotero Research Bridge Add-on

## Project overview

This directory contains the Zotero add-on for Zotero Research Bridge. It exposes an authenticated, loopback-only MCP server and safe, reviewable Zotero CRUD operations.

## Technology

- TypeScript
- Zotero Plugin API
- Firefox/Gecko runtime shipped with Zotero
- `zotero-plugin-scaffold` for development, testing, and packaging

## Compatibility

- Zotero 9.0.x, as declared in `addon/manifest.json`
- Developed and tested on macOS
- Other platforms are not yet in the verified test matrix

## Key directories

- `src/` — TypeScript source
- `src/modules/bridgePolicy.ts` — immutable network, identity, and write-policy defaults
- `src/modules/mutation*.ts` — mutation allowlist, planning, apply, and audit pipeline
- `addon/` — manifest, preferences UI, icons, and locales
- `test/` — unit tests
- `integration-test/` — isolated Zotero integration tests
- `.scaffold/build/` — generated build output; never commit it

## Commands

```bash
npm ci
npm run test:unit
npm run build
npm run lint:check
```

Integration tests:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=/Applications/Zotero.app/Contents/MacOS/zotero \
  npm test -- --no-watch --exit-on-finish
```

The integration suite must use `.scaffold/test/profile` and `.scaffold/test/data`, never a personal Zotero profile.

## Release process

The repository-level workflows in `../.github/workflows/` are authoritative.

1. Update `package.json`, `package-lock.json`, `SERVER_INFO_VERSION`, and `CHANGELOG.md`.
2. Run unit tests, integration tests, build, and static checks.
3. Commit to `main`.
4. Create an annotated `vX.Y.Z` tag matching `package.json`.
5. Push the tag. GitHub Actions rebuilds the XPI, generates `SHA256SUMS.txt`, and creates the release.

Automatic Zotero updates are intentionally disabled. Do not add an external update URL without a reviewed policy migration and tests.

## Security invariants

- Keep the listener loopback-only.
- Require bearer authentication for MCP requests.
- Keep write scopes disabled by default.
- Route mutations only through `plan_mutation` and `apply_mutation`.
- Do not expose permanent deletion or arbitrary JavaScript execution.
- Never write directly to `zotero.sqlite` or manipulate Zotero storage files.
- Redact note bodies, metadata values, tokens, and local source directories from audit logs.

## Code conventions

- Use `ztoolkit.log` for plugin logging.
- Keep comments and code documentation in English.
- Chinese locale files under `addon/locale/zh-CN/` are UI translations.
- Chinese stop-word lists in NLP code are functional data and must remain.
