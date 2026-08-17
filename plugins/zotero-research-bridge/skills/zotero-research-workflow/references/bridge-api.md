# Zotero Research Bridge API reference

## Connection

- Endpoint: `http://127.0.0.1:23121/mcp`
- Authentication token: discovered read-only from the local Zotero profile
- Optional token override: `ZOTERO_RESEARCH_BRIDGE_TOKEN`
- Required headers: `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json, text/event-stream`
- Initialize an MCP session before listing or calling tools.

Set `<skill-root>` to the absolute directory containing the installed Skill's `SKILL.md`. These commands are independent of the current working directory:

```bash
python3 "<skill-root>/scripts/bridge_client.py" ping
python3 "<skill-root>/scripts/bridge_client.py" doctor
python3 "<skill-root>/scripts/bridge_client.py" list-tools
python3 "<skill-root>/scripts/bridge_client.py" plan update_item --args-json '{"itemKey":"ABCDEFGH","fields":{"title":"Correct title"}}'
python3 "<skill-root>/scripts/bridge_client.py" apply plan_id confirm_token
```

For long note bodies, prefer `--args-file /absolute/path/arguments.json` over shell-quoted JSON.

## Mutation contract

`plan_mutation` accepts:

```json
{
  "operation": "add_note",
  "arguments": {
    "itemKey": "ABCDEFGH",
    "content": "<h1>Analysis</h1>...",
    "tags": ["zrb:analysis"]
  }
}
```

`apply_mutation` accepts only the returned `planId` and `confirmationToken`. A plan expires after ten minutes and can be consumed once. Exact mutation arguments remain stored in the plugin and cannot be changed during apply.

Available safe mutations include item/note creation and update, tag add/remove, collection add/remove/move, recoverable item trash/restore, URL or local-PDF attachment import, external-analysis HTML linking, related-item links, and bounded batch operations. Permanent deletion tools are intentionally unavailable.

Use `link_analysis_file` after validating a formal external reader report:

```json
{
  "operation": "link_analysis_file",
  "arguments": {
    "sourcePath": "/absolute/analysis-root/ABCDEFGH - Short Name/analysis.html",
    "parentItemKey": "ABCDEFGH",
    "title": "Paper Analysis - Short Name"
  }
}
```

The operation creates a Zotero linked-file attachment and leaves the HTML in the external analysis directory. Planning reports the file SHA-256 and whether the exact path will be linked or reused; applying the same path again skips duplication.

Audit records are stored at `Zotero.DataDirectory/zotero-research-bridge/mutation-audit.jsonl`. Note bodies, metadata values, and local source directories are redacted.
