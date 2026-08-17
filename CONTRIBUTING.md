# Contributing

Thank you for helping improve Zotero Research Bridge. Changes that affect write behavior, authentication, or Zotero data require especially careful review.

## Development setup

```bash
git clone https://github.com/z-jjj-y/zotero-research-bridge.git
cd zotero-research-bridge/zotero-mcp-plugin
npm ci
```

## Required verification

Run these checks before opening a pull request:

```bash
npm run test:unit
npm run build
npm run lint:check
npm audit --omit=dev
```

For changes that touch Zotero runtime behavior, also run the isolated integration suite:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=/Applications/Zotero.app/Contents/MacOS/zotero \
  npm test -- --no-watch --exit-on-finish
```

Never point the integration suite at a personal Zotero profile or production library.

If the research workflow Skill changes, validate it from the repository root:

```bash
uv run --with pyyaml python \
  ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  plugins/zotero-research-bridge/skills/zotero-research-workflow
```

Validate the Codex Plugin and its credential-discovery helper:

```bash
uv run --with pyyaml python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/zotero-research-bridge
python3 -m unittest discover -s tests
```

## Pull request expectations

- Keep changes focused and explain the user-visible outcome.
- Add or update tests for behavioral changes.
- Preserve loopback-only networking and mandatory authentication.
- Route every mutation through `plan_mutation` and `apply_mutation`.
- Do not add permanent deletion, arbitrary JavaScript execution, or direct SQLite writes.
- Preserve handwritten Zotero notes and existing attachments unless the requested operation explicitly targets them.
- Update `CHANGELOG.md` for user-visible changes.

## Sensitive data

Do not commit or attach:

- bearer tokens, API keys, or `.env` files;
- Zotero profiles, databases, storage directories, or audit logs;
- personal PDFs, notes, annotations, or bibliographic exports;
- local absolute paths that identify a contributor's machine.

Use synthetic test data and isolated test profiles.

## Upstream changes

The repository retains an `upstream` remote for `lricher7329/zotero-mcp-claude-code`. Merge upstream releases in a dedicated branch and explicitly re-test authentication, write scopes, mutation planning, audit redaction, attachment import, and note overwrite protection.
