---
name: zotero-research-workflow
description: Safely ingest, query, classify, analyze, update, trash, and restore research papers in a local Zotero library through Zotero Research Bridge. Use when a user provides a paper PDF or Zotero item and asks to add it to Zotero, organize it into research-topic/project/reading-status collections, analyze it with paper-analysis skills, write the analysis back as a child note, or perform Zotero CRUD without desktop automation.
---

# Zotero Research Workflow

Use Zotero as the source of truth and Zotero Research Bridge as the only write path. Never control the Zotero desktop UI, edit `zotero.sqlite`, or manipulate Zotero storage files directly.

## Connect

Prefer callable bridge MCP tools when available. Otherwise run `scripts/bridge_client.py` with `ZOTERO_RESEARCH_BRIDGE_TOKEN` exported. The bridge must resolve to loopback and normally listens at `http://127.0.0.1:23121/mcp`.

Run a health check before a workflow. If unavailable, report that Zotero must be running with Zotero Research Bridge enabled; do not fall back to Computer Use.

Read `references/bridge-api.md` only when constructing direct client calls or diagnosing protocol errors.

## Enforce write safety

Perform every mutation in two calls:

1. Call `plan_mutation` with an allowlisted operation and arguments.
2. Inspect `summary`, `preview`, `risk`, and `requiredScopes`.
3. Apply the exact plan with `apply_mutation(planId, confirmationToken)` only when it matches the user's request.

Require a fresh explicit confirmation before applying `high`-risk plans such as trashing items, bulk removals, batch trash, or library-wide tag renames. An earlier general request to organize or analyze papers is sufficient authorization for expected low/medium-risk imports, collection additions, metadata updates, and child-note writes.

Never request or attempt permanent collection deletion, permanent item deletion, trash emptying, or library-wide tag deletion. Preserve notes, annotations, and attachments when resolving duplicates.

## Ingest a local PDF

1. Read enough of the PDF to identify title, authors, year, venue, DOI, abstract, and keywords. Use a PDF skill for extraction when needed.
2. Search Zotero by DOI first, then normalized title. Reuse the existing parent item when the match is unambiguous.
3. If no parent exists, plan and apply `create_item` with the best verified metadata. Put uncertain data in the analysis, not invented metadata fields.
4. Plan `import_attachment_file` with `sourcePath`, `parentItemKey`, and `ifExists: "skip"`. Verify the returned SHA-256, target parent, and dedup decision before applying.
5. Never replace an existing attachment automatically. Use `ifExists: "replace"` only after the user explicitly requests replacement and the preview identifies the intended duplicate.

## Classify

Read `references/classification-taxonomy.md` before assigning research topics.

- Preserve existing `02_研究项目` and `03_阅读状态` memberships unless the user explicitly changes them.
- Assign one to three leaf collections under `01_研究主题` using title, abstract, keywords, research problem, core method, and application domain.
- Allow the same Zotero item in multiple collections; this does not duplicate its PDF.
- Resolve collection paths to collection keys before planning `add_to_collection`.
- Put uncertain assignments in `99_待整理` and report the uncertainty instead of forcing a weak topic.

## Analyze and write back

Choose the analysis skill by output need:

- Use `analyzing-research-papers` by default for structured research notes.
- Use `paper-analyzer` when the user asks for a deep, shareable HTML explanation.
- Use another named paper skill when the user explicitly requests it.

Base the analysis on the actual PDF, not only Zotero metadata. Cover the research problem, motivation, method, key equations or algorithm, datasets, experimental setup, results, contributions, limitations, reproducibility, and relevance to the user's research.

Write the result under the Zotero parent item as an HTML child note. Include this marker near the top:

`ZRB_ANALYSIS_V1:<analysis-kind>`

Before writing, inspect existing child notes for the same marker. Plan `update_note` when it exists; otherwise plan `add_note`. Add tags `zrb:analysis` and `zrb:analyzer:<analysis-kind>` on a new note. Do not overwrite handwritten notes or notes with a different marker.

## Report completion

Return the parent item key, attachment key and hash, assigned collection paths, analysis method, note key, and any skipped duplicate or low-confidence classification. Link local analysis artifacts when one was also produced outside Zotero.
