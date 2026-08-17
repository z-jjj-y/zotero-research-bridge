# Changelog

All notable changes to Zotero Research Bridge are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Installable Codex Plugin manifest with the Zotero research workflow bundled.
- Read-only Zotero profile credential discovery, so normal Codex use does not require manual MCP or token configuration.
- Built-in structured paper-analysis fallback when no optional analysis Skill is installed.
- One-click recommended workflow permissions in Zotero settings.
- Python tests for local credential discovery.
- A portability regression test ensuring the bundled client is resolved from the installed Skill rather than the current workspace.
- A map-first paper workflow that always writes a validated external `map.json` and generates an external `analysis.html` only when explicitly requested.
- A guarded `link_analysis_file` mutation that attaches the external HTML to its Zotero parent as a deduplicated linked file without copying it into managed storage.
- A dependency-free matching-profile validator with provenance and referential-integrity checks.
- Explicit no-code handling for papers with announced, unofficial, or unavailable implementations.

### Changed

- Limited production reader reports to `academic` and `storytelling`, with the default set to no report and multi-style output isolated under `_style-preview`.
- Moved optional readable reports out of Zotero and required static MathML or pre-rendered KaTeX HTML+MathML without runtime scripts or CDN dependencies.
- Reframed the main Zotero settings page around the conversational research workflow and moved protocol details into collapsed advanced sections.
- Moved the workflow Skill under the standard `skills/` plugin layout.
- Made all bundled scripts and references resolve from the installed Skill root, so the workflow works from any directory and in new direct Codex conversations.
- Upgraded human-readable paper notes to the evidence-grounded `deep-reading-v2` format while keeping research-transfer and innovation suggestions in separate matching or synthesis artifacts.

### Fixed

- Redacted titles, collection names, tags, creators, URLs, summaries, and error text from mutation audit records while preserving non-sensitive keys, counts, statuses, hashes, and field names.
- Rejected unknown `move_collection` arguments instead of silently interpreting an invalid parent field as a move to the library root.
- Prevented long UTF-8 MCP request bodies from being truncated after the first buffered read, allowing full paper analyses and matching profiles to be saved reliably.

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
