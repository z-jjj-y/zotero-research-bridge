# Problem–method matching profile

Use this template for every formal paper-analysis run. `map.json` is the required production artifact even when no human-readable report is requested.

## File identity and location

- Schema: `ZRB_MATCH_PROFILE_V1`
- Required filename: `map.json`
- Directory identity: Zotero parent `itemKey`
- Path: `<analysis-root>/<itemKey> - <Short Name>/map.json`
- One map per Zotero parent item. Update the existing file bound to the same `source.itemKey` instead of creating a duplicate.

Prefer the official paper abbreviation for `<Short Name>`; otherwise use a plain-English topic name no longer than 50 characters. Treat the short name as display text only. Keep `source.itemKey`, `source.attachmentKey`, `source.attachmentSha256`, and `source.title` inside the JSON as the durable Zotero binding.

Do not wrap the JSON in HTML, create a Zotero child note, or create a second human-readable map. Write to a temporary file, validate it, and replace the target `map.json` only after validation succeeds.

## Evidence rules

- Base every problem, method, and internal match on the actual PDF.
- Distinguish `author-stated` from `system-inferred` evidence.
- Include a page, section, figure, table, equation, or appendix locator whenever the extracted PDF exposes it.
- Use `unknown` and add an uncertainty instead of inventing missing assumptions, complexity, inputs, outputs, or results.
- Keep evidence summaries short and paraphrased. Do not copy long passages.
- A paper-level profile records only relationships demonstrated or proposed inside that paper. Cross-paper candidate matches belong to a later synthesis artifact.
- Treat code as optional corroborating evidence. When no official repository exists, derive the profile from the PDF and mark unreported implementation details as unknown. Never treat third-party code as the authors' implementation.

## Machine-readable JSON

Build and validate the JSON with:

```bash
python3 "<skill-root>/scripts/validate_matching_profile.py" profile.json
```

Use this shape:

```json
{
  "schema": "ZRB_MATCH_PROFILE_V1",
  "generatedAt": "2026-08-16T00:00:00Z",
  "source": {
    "itemKey": "ABCDEFGH",
    "attachmentKey": "HGFEDCBA",
    "attachmentSha256": null,
    "title": "Paper title"
  },
  "problems": [
    {
      "id": "P1",
      "statement": "The specific problem addressed or left open.",
      "rootCause": "Why the problem occurs, or unknown.",
      "context": ["task, data, or operating context"],
      "constraints": ["relevant constraint"],
      "requiredCapabilities": ["capability a candidate method must provide"],
      "status": "addressed",
      "evidence": [
        {
          "locator": "Section 1, p. 2",
          "basis": "author-stated",
          "confidence": "high",
          "summary": "Short paraphrase of the supporting evidence."
        }
      ]
    }
  ],
  "methods": [
    {
      "id": "M1",
      "name": "Method or module name",
      "level": "module",
      "purpose": "What it is intended to accomplish.",
      "mechanism": "How it produces the intended effect.",
      "inputs": ["input"],
      "outputs": ["output"],
      "assumptions": ["assumption or unknown"],
      "complexity": "Reported complexity or unknown",
      "validatedEffects": ["effect supported by an experiment or proof"],
      "transferableParts": ["component that may transfer"],
      "incompatibilities": ["known boundary or incompatible condition"],
      "evidence": [
        {
          "locator": "Section 3.2, p. 5",
          "basis": "author-stated",
          "confidence": "high",
          "summary": "Short paraphrase of the method evidence."
        }
      ]
    }
  ],
  "internalMatches": [
    {
      "problemId": "P1",
      "methodId": "M1",
      "relationship": "solves",
      "mechanismFit": "Why this mechanism addresses the problem.",
      "adaptationRequired": [],
      "evidence": [
        {
          "locator": "Table 2 and Section 4.3",
          "basis": "system-inferred",
          "confidence": "medium",
          "summary": "The ablation supports the proposed internal mapping."
        }
      ]
    }
  ],
  "openQuestions": ["Question that remains open after this paper"],
  "uncertainties": ["Information that could not be verified from the PDF"]
}
```

Allowed values:

- Problem status: `addressed`, `partially-addressed`, `open`, `unclear`
- Method level: `framework`, `module`, `representation`, `objective`, `training-strategy`, `inference`, `evaluation`
- Relationship: `solves`, `mitigates`, `supports`, `evaluates`
- Evidence basis: `author-stated`, `system-inferred`
- Confidence: `high`, `medium`, `low`
