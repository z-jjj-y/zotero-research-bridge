# Repository guidance

## Purpose

Zotero Research Bridge is an open-source, local-first integration between Zotero and MCP clients. It combines a Zotero add-on with a Codex research workflow Skill.

## Components

- `zotero-mcp-plugin/` — Zotero add-on, MCP server, safe CRUD implementation, and tests.
- `zotero-research-workflow/` — Codex Skill for ingestion, deduplication, classification, analysis, and child-note writeback.

Read `zotero-mcp-plugin/CLAUDE.md` before modifying add-on code and `zotero-research-workflow/SKILL.md` before modifying the workflow.

## Safety rules

- Treat Zotero as the source of truth.
- Never automate the Zotero desktop UI when an MCP/API operation exists.
- Never write directly to `zotero.sqlite` or Zotero storage files.
- Keep networking loopback-only and authenticated.
- Keep write scopes disabled by default.
- Perform every mutation through `plan_mutation` and `apply_mutation`.
- Do not add permanent deletion, trash emptying, library-wide tag deletion, or arbitrary JavaScript execution.
- Preserve handwritten notes, annotations, and attachments.
- Never commit tokens, API keys, Zotero profiles, personal PDFs, audit logs, or machine-specific paths.

## Verification

From `zotero-mcp-plugin/`:

```bash
npm run test:unit
npm run build
npm run lint:check
```

Use the isolated Zotero integration suite for runtime changes. Validate the workflow Skill with the Codex skill validator.

## Git remotes

- `origin` is the maintained repository: `z-jjj-y/zotero-research-bridge`.
- `upstream` is the read-only source project: `lricher7329/zotero-mcp-claude-code`.

Merge upstream changes in a dedicated branch and re-test all security invariants.
