# Changelog

All notable changes to Zotero Research Bridge are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Broader platform verification beyond macOS.
- A reviewed update channel that preserves the current security policy.
- Additional end-to-end tests for import, classification, and note updates.

## [0.1.0] - 2026-08-15

### Added

- Local-only Zotero MCP bridge on port `23121`.
- Mandatory bearer-token authentication.
- Granular write scopes for notes, tags, collections, metadata, imports, recoverable deletion, and bounded bulk operations.
- Two-phase `plan_mutation` → `apply_mutation` workflow with expiring, one-use confirmation tokens.
- Safe CRUD operations for items, notes, tags, collections, attachments, related items, trash, and restore.
- Local PDF attachment import with SHA-256 reporting and duplicate policies.
- Redacted JSONL mutation audit log.
- Isolated Zotero integration tests and mutation-safety unit tests.
- `zotero-research-workflow` Codex Skill for ingestion, deduplication, classification, paper analysis, and child-note writeback.
- English project README and Chinese architecture/maintenance guide.

### Changed

- Renamed the add-on and preference namespace to Zotero Research Bridge.
- Hardened the HTTP/MCP server for loopback-only, authenticated operation.
- Disabled legacy direct mutation calls in favor of reviewed two-phase writes.
- Updated item formatting for real Zotero item shapes and identifier round-tripping.

### Security

- Permanent deletion, trash emptying, permanent collection deletion, library-wide tag deletion, arbitrary JavaScript execution, and direct SQLite writes are unavailable.
- Audit records redact note bodies, metadata values, and local source paths.

[Unreleased]: https://github.com/z-jjj-y/zotero-research-bridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/z-jjj-y/zotero-research-bridge/releases/tag/v0.1.0
