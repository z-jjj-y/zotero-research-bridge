from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).parents[1]
    / "plugins"
    / "zotero-research-bridge"
    / "skills"
    / "zotero-research-workflow"
    / "scripts"
    / "validate_matching_profile.py"
)
SPEC = importlib.util.spec_from_file_location("zrb_matching_profile", SCRIPT_PATH)
assert SPEC and SPEC.loader
matching_profile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(matching_profile)


def valid_profile() -> dict:
    evidence = {
        "locator": "Section 3.2, p. 5",
        "basis": "author-stated",
        "confidence": "high",
        "summary": "The paper defines and evaluates the module.",
    }
    return {
        "schema": "ZRB_MATCH_PROFILE_V1",
        "generatedAt": "2026-08-16T00:00:00Z",
        "source": {
            "itemKey": "ABCDEFGH",
            "attachmentKey": "HGFEDCBA",
            "attachmentSha256": None,
            "title": "Example paper",
        },
        "problems": [
            {
                "id": "P1",
                "statement": "Long histories are expensive to encode.",
                "rootCause": "The baseline attends over all historical events.",
                "context": ["temporal graph reasoning"],
                "constraints": ["long event sequences"],
                "requiredCapabilities": ["linear-time history modeling"],
                "status": "addressed",
                "evidence": [evidence],
            }
        ],
        "methods": [
            {
                "id": "M1",
                "name": "Selective state-space module",
                "level": "module",
                "purpose": "Encode long event histories.",
                "mechanism": "Compress history into a recurrent state.",
                "inputs": ["ordered event embeddings"],
                "outputs": ["history representation"],
                "assumptions": ["events have a usable order"],
                "complexity": "Linear in sequence length",
                "validatedEffects": ["Improved long-history performance"],
                "transferableParts": ["history encoder"],
                "incompatibilities": ["unordered event sets"],
                "evidence": [evidence],
            }
        ],
        "internalMatches": [
            {
                "problemId": "P1",
                "methodId": "M1",
                "relationship": "mitigates",
                "mechanismFit": "The recurrent state avoids full history attention.",
                "adaptationRequired": [],
                "evidence": [evidence],
            }
        ],
        "openQuestions": ["Does the effect transfer to sparse relations?"],
        "uncertainties": [],
    }


class MatchingProfileValidationTest(unittest.TestCase):
    def test_accepts_valid_profile(self) -> None:
        self.assertEqual(matching_profile.validate_profile(valid_profile()), [])

    def test_rejects_dangling_internal_match(self) -> None:
        profile = valid_profile()
        profile["internalMatches"][0]["methodId"] = "M9"
        errors = matching_profile.validate_profile(profile)
        self.assertTrue(any("unknown method M9" in error for error in errors))

    def test_requires_evidence_provenance(self) -> None:
        profile = valid_profile()
        del profile["problems"][0]["evidence"][0]["basis"]
        errors = matching_profile.validate_profile(profile)
        self.assertTrue(any("evidence[0].basis" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

