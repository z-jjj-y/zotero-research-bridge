# Zotero Research Bridge

[![CI](https://github.com/z-jjj-y/zotero-research-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/z-jjj-y/zotero-research-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zotero 9](https://img.shields.io/badge/Zotero-9.0-blue)](https://www.zotero.org/)

An open-source, local-first research-management bridge for Zotero. It exposes Zotero search, PDF access, structured CRUD, and recoverable library-management operations to MCP clients while keeping all traffic on the local machine.

The repository is also a Codex Plugin. Its bundled workflow Skill connects PDF ingestion, deduplication, multi-axis classification, paper analysis, and external problem–method map generation into one guarded workflow. The required output is `map.json`; a deep HTML reading report is generated only when explicitly requested. The bundled client discovers the local Zotero credential read-only, so normal Codex use does not require copying tokens or editing MCP configuration.

中文项目说明：[PROJECT_OVERVIEW.zh-CN.md](PROJECT_OVERVIEW.zh-CN.md)

## Why this project exists

Zotero already manages papers well, and paper-analysis agents already read PDFs well. The missing layer is a safe bridge between them. Zotero Research Bridge makes it possible to:

- retrieve a paper and its PDF from a local Zotero library;
- add papers and attachments without desktop automation;
- classify one item into multiple research collections without duplicating its PDF;
- deeply analyze the actual PDF with an evidence-grounded paper-analysis workflow, whether or not official source code exists;
- always create or update an external validated `map.json` for later cross-paper matching and innovation analysis;
- optionally create one external `analysis.html` in academic or storytelling style, only after an explicit request;
- update, trash, and restore items through reviewable, recoverable operations.

## Architecture

```text
MCP client / Codex
        │  Bearer-authenticated MCP over loopback
        ▼
Zotero Research Bridge add-on
        │  Zotero APIs
        ▼
Local Zotero library and attachments

Codex workflow Skill ──► PDF / optional code analysis ──► required map.json
                                                   └──► optional analysis.html
```

## Paper-analysis output contract

Formal paper analysis is map-first. Each paper uses an external directory identified by its Zotero parent item key:

```text
<analysis-root>/<itemKey> - <Short Name>/map.json
<analysis-root>/<itemKey> - <Short Name>/analysis.html   # explicit opt-in only
```

`map.json` is always produced. `analysis.html` defaults to absent and supports only `academic` or `storytelling`; multi-style comparisons belong under `_style-preview`, not in the production directory. Browser formulas in the optional report are stored as static MathML or pre-rendered KaTeX HTML+MathML, so the final file does not depend on runtime JavaScript or a CDN. Missing official code never blocks analysis: the workflow falls back to the paper's equations, algorithms, pseudocode, reported settings, and explicit reproducibility gaps.

## Repository layout

- `zotero-mcp-plugin/` — Zotero add-on source, unit tests, and isolated integration tests.
- `.agents/plugins/marketplace.json` — Git-installable Codex marketplace entry.
- `plugins/zotero-research-bridge/` — Codex Plugin manifest and bundled workflow Skill.
- `PROJECT_OVERVIEW.zh-CN.md` — detailed Chinese architecture and maintenance guide.
- `CONTRIBUTING.md` — contribution and verification workflow.
- `SECURITY.md` — security policy and reporting guidance.
- `CHANGELOG.md` — project release history.

## Safety model

- The server is hard-coded to listen on loopback only (`127.0.0.1`), using port `23121` by default.
- MCP access requires a bearer token.
- Write access is split into notes, tags, collections, metadata, import, delete, and bulk scopes; every scope is disabled by default.
- Every mutation uses a time-limited, one-use `plan_mutation` → `apply_mutation` protocol.
- Mutation arguments are retained server-side, so they cannot be changed between review and apply.
- Audit logs redact note bodies, metadata values, and local source directories.
- Optional reader reports remain as portable external HTML files; Zotero stores only a linked-file entry point, never a second report copy.
- Trash and restore are supported; permanent item deletion, trash emptying, permanent collection deletion, and library-wide tag deletion are intentionally unavailable.
- The bridge does not execute arbitrary JavaScript and never writes directly to `zotero.sqlite`.

See [SECURITY.md](SECURITY.md) before enabling write scopes.

## Requirements

- Zotero 9.0.x
- Node.js 20 or newer for development
- An MCP client that supports Streamable HTTP

The current maintainer tests on macOS. Other platforms should work where Zotero and the local MCP transport are available, but are not yet part of the verified matrix.

## Everyday quick start

1. Download `zotero-research-bridge.xpi` from the latest GitHub Release.
2. In Zotero, open **Tools → Add-ons**.
3. Choose **Install Add-on From File…** and select the XPI.
4. Install the companion Codex Plugin:

   ```bash
   codex plugin marketplace add z-jjj-y/zotero-research-bridge
   codex plugin add zotero-research-bridge@zrb-marketplace
   ```

5. In Zotero, open **Settings → Research Assistant** and click **Enable Recommended Workflow**.
6. Start a new Codex conversation and ask it to organize, analyze, or annotate your Zotero papers.

Formal paper analysis is map-first: each paper receives a required external `map.json`. A readable `analysis.html` is generated only when requested, validated for offline formulas and embedded resources, and linked back under the Zotero parent item for one-click opening.

The Codex Plugin is installed at user scope and loaded from Codex's plugin cache. After starting a new conversation it works from any workspace, an empty temporary directory, or a direct Codex chat; the repository does not need to be the current directory. Do not install a second standalone copy of `zotero-research-workflow`, because duplicate Skills can shadow the Plugin version.

The normal Codex workflow does not require manual MCP setup or token copying. The repository can be installed directly as a Codex marketplace while public catalog submission is pending. Advanced users can still configure the MCP endpoint manually.

Automatic updates are intentionally disabled in v0.1.0. Upgrade by installing a reviewed XPI from this repository. See [AUTO_UPDATE_GUIDE.md](AUTO_UPDATE_GUIDE.md).

## Build and verify

```bash
cd zotero-mcp-plugin
npm ci
npm run test:unit
npm run build
npm run lint:check
npm audit --omit=dev
```

Run the isolated Zotero integration tests with:

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=/Applications/Zotero.app/Contents/MacOS/zotero \
  npm test -- --no-watch --exit-on-finish
```

The integration suite uses `.scaffold/test/profile` and `.scaffold/test/data`; it must not use a personal Zotero profile or library.

Validate the workflow Skill with:

```bash
uv run --with pyyaml python \
  ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  plugins/zotero-research-bridge/skills/zotero-research-workflow
```

Validate the Codex Plugin with:

```bash
uv run --with pyyaml python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/zotero-research-bridge
python3 -m unittest discover -s tests
```

`npm run build` creates `.scaffold/build/zotero-research-bridge.xpi`.

## MCP endpoint

The production policy exposes the MCP endpoint at:

```text
http://127.0.0.1:23121/mcp
```

The token must be supplied as `Authorization: Bearer <token>`. The bundled Codex workflow discovers it read-only from the local Zotero profile. Manual clients may use `ZOTERO_RESEARCH_BRIDGE_TOKEN`. Never commit the token to a repository or paste it into issue reports.

## Upstream and license

This project is derived from [`lricher7329/zotero-mcp-claude-code` v1.8.6](https://github.com/lricher7329/zotero-mcp-claude-code), itself based on the Zotero MCP ecosystem. The upstream foundation provides the Zotero integration, read/search stack, PDF extraction, and MCP transport. This repository adds the hardened local policy, authenticated and scoped writes, two-phase mutation protocol, audit redaction, integration tests, and research workflow Skill.

Distributed under the [MIT License](LICENSE). Upstream copyright and license notices are retained.

## Project status

The project is usable for local research workflows but should be treated as an early release. Back up important Zotero libraries, review every mutation plan, and test new releases on non-critical items before enabling destructive scopes.
