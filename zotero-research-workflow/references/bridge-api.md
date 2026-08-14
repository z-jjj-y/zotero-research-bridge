# Zotero Research Bridge API

## Connection

- Endpoint: `http://127.0.0.1:23121/mcp`
- Token environment variable: `ZOTERO_RESEARCH_BRIDGE_TOKEN`
- Required headers: `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json, text/event-stream`
- Initialize an MCP session before listing or calling tools.

Use `scripts/bridge_client.py`:

```bash
python3 scripts/bridge_client.py ping
python3 scripts/bridge_client.py list-tools
python3 scripts/bridge_client.py plan update_item --args-json '{"itemKey":"ABCDEFGH","fields":{"title":"Correct title"}}'
python3 scripts/bridge_client.py apply plan_id confirm_token
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

Available safe mutations include item/note creation and update, tag add/remove, collection add/remove/move, recoverable item trash/restore, URL or local-PDF attachment import, related-item links, and bounded batch operations. Permanent deletion tools are intentionally unavailable.

Audit records are stored at `Zotero.DataDirectory/zotero-research-bridge/mutation-audit.jsonl`. Note bodies, metadata values, and local source directories are redacted.
