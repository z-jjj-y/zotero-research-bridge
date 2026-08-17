---
name: zotero-research-workflow
description: Safely ingest, query, classify, analyze, build required machine-readable problem–method maps, update, trash, and restore research papers in a local Zotero library through conversation. Use when a user mentions Zotero, provides a paper PDF or Zotero item, asks to organize a literature library, analyze a paper, prepare method–problem matching or innovation analysis, optionally generate an academic or storytelling HTML reading report, manage research-topic/project/reading-status collections, or perform Zotero CRUD without desktop automation or manual MCP configuration.
---

# Zotero Research Bridge Workflow

Use Zotero as the bibliographic source of truth and Zotero Research Bridge as the only Zotero write path. Keep required maps and optional reader reports in the configured external analysis root. Never control the Zotero desktop UI, edit `zotero.sqlite`, or manipulate Zotero storage files directly.

## Resolve bundled resources

Set `<skill-root>` to the absolute directory containing this installed `SKILL.md`. Resolve every bundled script and reference from `<skill-root>`, regardless of the current workspace or shell directory. Never search the current project for another copy of this Skill, `bridge_client.py`, or its reference files.

## Connect

Prefer callable bridge tools when available. Otherwise run `python3 "<skill-root>/scripts/bridge_client.py"`; it discovers the authentication token read-only from the local Zotero profile. `ZOTERO_RESEARCH_BRIDGE_TOKEN` remains an optional advanced override. The bridge must resolve to loopback and normally listens at `http://127.0.0.1:23121/mcp`.

Run `python3 "<skill-root>/scripts/bridge_client.py" doctor` before a workflow when using the bundled client. If unavailable, tell the user to open Zotero and enable Zotero Research Bridge. Do not ask the user to configure MCP or copy a token first, and do not fall back to Computer Use.

Read `<skill-root>/references/bridge-api.md` only when constructing direct client calls or diagnosing protocol errors.

## Enforce Zotero write safety

Perform every Zotero mutation in two calls:

1. Call `plan_mutation` with an allowlisted operation and arguments.
2. Inspect `summary`, `preview`, `risk`, and `requiredScopes`.
3. Apply the exact plan with `apply_mutation(planId, confirmationToken)` only when it matches the user's request.

Require a fresh explicit confirmation before applying `high`-risk plans such as trashing items, bulk removals, batch trash, or library-wide tag renames. An earlier general request to organize papers is sufficient authorization for expected low/medium-risk imports, collection additions, and metadata updates.

Never request or attempt permanent collection deletion, permanent item deletion, trash emptying, or library-wide tag deletion. Preserve notes, annotations, and attachments when resolving duplicates.

## Ingest a local PDF

1. Read enough of the PDF to identify title, authors, year, venue, DOI, abstract, and keywords.
2. Search Zotero by DOI first, then normalized title. Reuse the existing parent item when the match is unambiguous.
3. If no parent exists, plan and apply `create_item` with verified metadata. Put uncertain data in the analysis, not invented metadata fields.
4. Plan `import_attachment_file` with `sourcePath`, `parentItemKey`, and `ifExists: "skip"`. Verify the returned SHA-256, target parent, and dedup decision before applying.
5. Never replace an existing attachment automatically. Use `ifExists: "replace"` only after an explicit request and a preview identifying the intended duplicate.

## Classify

Read `<skill-root>/references/classification-taxonomy.md` before assigning research topics.

- Preserve existing `02_研究项目` and `03_阅读状态` memberships unless the user explicitly changes them.
- Assign one to three leaf collections under `01_研究主题` using title, abstract, keywords, research problem, core method, and application domain.
- Allow the same Zotero item in multiple collections; this does not duplicate its PDF.
- Resolve collection paths to keys before planning `add_to_collection`.
- Put uncertain assignments in `99_待整理` instead of forcing a weak topic.

## Analyze the paper once

Base every output on the actual PDF, not only Zotero metadata. Read the full paper far enough to recover the problem chain, method architecture, modules, key equations or algorithms, training and inference, experimental setup, exact results, ablations, contributions, limitations, and reproducibility evidence. Attach PDF locators to important claims and separate author statements from system inferences.

Treat an official code repository as optional evidence, never as a prerequisite:

- First inspect code links or availability statements in the paper, then search the exact title and author names when needed.
- Classify code status as `official`, `announced`, `unofficial`, or `none`.
- When official code exists, use it to verify implementation details and cite file paths and line ranges.
- When code is announced but unavailable, record that status and do not infer implementation details.
- When only third-party implementations exist, label them `unofficial` and never use them as evidence of the authors' implementation.
- When no code exists, continue from the PDF. Explain equations, algorithms, pseudocode, architecture, and reported settings; mark unreported implementation details as unknown; do not fabricate code snippets or fail the workflow.

## Use a map-first output contract

For a formal paper-analysis run, always create or update the machine-readable `map.json`. The default reader-report option is `none`.

- Required: `map.json`.
- Optional only after an explicit user request: one `analysis.html` in either `academic` or `storytelling` style.
- Do not generate a concise report in the formal workflow.
- Keep at most one formal `analysis.html` beside `map.json`. If the user explicitly requests a multi-style comparison, put comparison files under a separate `_style-preview` directory and do not treat them as production artifacts.
- Do not create extra manifests, asset folders, Markdown copies, Zotero analysis notes, or matching-profile notes by default.
- When `analysis.html` is generated, plan and apply `link_analysis_file` so the Zotero parent receives one linked-file child titled `Paper Analysis - <Short Name>`. The link must point to the external report; do not copy the HTML into Zotero storage. Reuse an existing linked attachment with the same absolute path instead of creating a duplicate.

Resolve `<analysis-root>` from the user's configured external analysis directory. Reuse the existing directory whose identity is the Zotero parent `itemKey`; a human-readable short name may appear in the directory name but must not be the identity. Store only:

```text
<analysis-root>/<itemKey> - <Short Name>/map.json
<analysis-root>/<itemKey> - <Short Name>/analysis.html   # explicit opt-in only
```

Prefer the official paper abbreviation for `<Short Name>`; otherwise use a plain-English topic name no longer than 50 characters. Embed the Zotero parent key, attachment key, attachment SHA-256 when available, and full title in `map.json` so the artifact remains bound to its source item even if the display name changes.

## Build the required problem–method map

Read `<skill-root>/references/matching-profile-template.md` and build the map with schema `ZRB_MATCH_PROFILE_V1`. Extract paper- and module-level problem cards, method cards, evidence locators, assumptions, validated effects, transfer boundaries, and only problem–method relationships established inside that paper. Record uncertainty instead of guessing. Keep cross-paper candidate matches for a later synthesis artifact.

Create the JSON profile in a temporary file, validate it with `python3 "<skill-root>/scripts/validate_matching_profile.py" profile.json`, then replace the target `map.json` only after validation succeeds. Preserve the existing source `itemKey` binding when updating. Do not wrap the JSON in HTML and do not write it back as a Zotero child note.

## Generate an optional reader report

Generate `analysis.html` only when the user explicitly asks for a readable report and selects or accepts `academic` or `storytelling`. Read `<skill-root>/references/analysis-report-template.md` before rendering it.

Use `paper-analyzer` when available, but override its default style prompt and output rules with this Skill's selected style and external-artifact contract. Otherwise use `analyzing-research-papers` or the built-in PDF analysis. The report must explain the paper itself; do not include user-specific method-transfer proposals or cross-paper innovation ideas.

Render formulas as browser-readable static MathML or pre-rendered KaTeX HTML+MathML. LaTeX may be used only as an authoring intermediate; do not leave raw `$...$`/`$$...$$` as the final visible formula and do not require runtime MathJax, KaTeX, Mermaid, CDN, or network access. Embed required images and styles in the HTML. Omit source-code sections when no official code exists and expand the algorithm/equation and reproducibility discussion instead.

Before replacing the formal report, validate the temporary file with:

```bash
python3 "<skill-root>/scripts/validate_analysis_report.py" analysis.html \
  --item-key "<itemKey>" --attachment-key "<attachmentKey>" \
  --min-math 5 --min-paragraphs 20
```

Fix every validation error before publishing. External paper or repository hyperlinks are allowed, but every stylesheet, image, diagram, and formula required for reading must remain embedded and work offline.

After validation, create or reuse the Zotero entry point through `plan_mutation` with operation `link_analysis_file` and arguments `sourcePath`, `parentItemKey`, and `title`. Inspect that the preview reports the expected absolute file, parent item, SHA-256, and `link` or `skip` decision; then apply and reread the parent attachments. This link is optional when the reader report is skipped because no `analysis.html` exists.

## Report completion

Return the Zotero parent item key, attachment key and hash, assigned collection paths, code status, required `map.json` path, optional `analysis.html` path when generated, and any skipped duplicate or low-confidence classification. State explicitly when the reader report was skipped by default.
