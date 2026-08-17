# Optional external analysis report

Use this contract only after the user explicitly requests a human-readable paper report. The required `map.json` remains independent and must be generated even when this report is skipped.

## Output contract

- Filename: `analysis.html`
- Path: `<analysis-root>/<itemKey> - <Short Name>/analysis.html`
- Supported styles: `academic` or `storytelling`
- Default reader-report option: `none`
- At most one formal `analysis.html` per paper
- No `concise` production style

Use the official paper abbreviation for `<Short Name>` when available; otherwise use a plain-English topic name no longer than 50 characters. Keep the complete paper title and Zotero source identity in the visible bibliographic section and in HTML metadata.

If the user explicitly requests both styles for comparison, write comparison-only files under `<analysis-root>/_style-preview/<Short Name>/`. Do not copy those files into the formal item directory and do not change its two-file maximum.

## Shared evidence rules

Base the report on the actual PDF. Explain the problem chain, motivation, complete input-to-output method, important modules, key equations or algorithms, training and inference, experimental protocol, exact quantitative results, ablations, contributions, limitations, and reproducibility. Attach page, section, figure, table, equation, algorithm, or appendix locators to important claims.

Separate author claims from analytical assessment. Do not add user-specific research relevance, cross-paper method transfer, matching suggestions, or innovation proposals; those belong in `map.json` and later synthesis artifacts.

## Code availability is optional

Record one of these statuses in the bibliographic or reproducibility section:

- `official`: repository linked by the paper or verified as author-maintained;
- `announced`: authors state code will be released, but it is not available;
- `unofficial`: only third-party implementations were found;
- `none`: no implementation was found after checking the paper and a targeted title/author search.

When status is `official`, use source excerpts only where they clarify the paper and label each excerpt with repository URL, commit when available, file path, and line range. When status is `announced`, `unofficial`, or `none`, do not invent or require code snippets. Replace the source-code mapping section with a reproducibility analysis based on algorithms, pseudocode, equations, configuration details, reported compute, and missing implementation information. Never present unofficial code as evidence of the authors' implementation.

## Static browser math

HTML has no LaTeX authoring syntax. Use LaTeX only as an intermediate when convenient, then pre-render every formula into static browser-readable HTML+MathML before saving the final file.

Acceptable final forms include native MathML:

```html
<math display="inline" aria-label="x sub t">
  <msub><mi>x</mi><mi>t</mi></msub>
</math>
```

or pre-rendered KaTeX output containing both visual HTML and a MathML accessibility subtree. The final `analysis.html` must:

- display formulas without JavaScript or network access;
- contain no unresolved visible `$...$` or `$$...$$` delimiters;
- contain no runtime MathJax, KaTeX auto-render, Mermaid, CDN, or external stylesheet dependency;
- preserve accessible MathML or an equivalent text description;
- keep ordinary code and pseudocode outside math elements.

Use a static SVG or embedded image for a generated architecture diagram when necessary. Embed CSS and required images in the HTML so the single file remains portable.

## Academic style

Use this style for systematic technical reading:

1. Bibliographic identity, source keys, code status, and one-sentence result.
2. Background, prior approaches, concrete limitation, root cause, and research question.
3. Prerequisites needed to understand the method.
4. Complete method overview followed by module-level explanations.
5. Essential formulas and algorithms with symbol definitions and plain-language interpretations.
6. Training and inference as separate flows.
7. Experimental setup, main results, ablations, and evidence-to-claim mapping.
8. Strengths, limitations, threats to validity, reproducibility, and open questions.
9. Paper-scoped conclusion.

For a normal methods paper in Chinese, target roughly 4,000–8,000 Chinese characters and at least 20 substantive paragraphs. Scale depth to the paper rather than padding. Include paper figures or tables when extraction quality permits. Require code excerpts only for `official` code status.

## Storytelling style

Use this style for continuous explanatory reading without sacrificing evidence:

1. Open with a concrete problem or scene rather than terminology.
2. Explain why existing approaches reach a bottleneck.
3. Reveal the paper's central insight in plain language.
4. Walk through the method as a causal story: what enters, what changes, why each design exists, and what leaves.
5. Translate the most persuasive experiments into consequences, not just numbers.
6. Close the loop with limitations and the supported takeaway.

For a normal methods paper in Chinese, target roughly 3,000–6,000 Chinese characters and at least 15 substantive paragraphs. Use short quotations sparingly, include at least two useful analogies, and keep exact values and PDF locators. Do not turn the report into marketing copy.

## Final checks

- Confirm `map.json` exists or is being produced in the same run.
- Confirm the user explicitly requested the reader report.
- Confirm exactly one of `academic` or `storytelling` was selected for the formal file.
- Confirm code status is explicit and no-code papers remain fully analyzable.
- Confirm formulas render with scripting and network access disabled.
- Confirm the report contains no cross-paper matching or innovation proposal.
- Confirm the formal item directory contains only `map.json` and optional `analysis.html`.
