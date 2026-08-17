from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).parents[1]
    / "plugins"
    / "zotero-research-bridge"
    / "skills"
    / "zotero-research-workflow"
    / "scripts"
    / "bridge_client.py"
)
SKILL_ROOT = SCRIPT_PATH.parents[1]
SPEC = importlib.util.spec_from_file_location("zrb_bridge_client", SCRIPT_PATH)
assert SPEC and SPEC.loader
bridge_client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge_client)

TOKEN = "zmcp_0123456789abcdef0123456789abcdef0123456789abcdef"


class BridgeCredentialDiscoveryTest(unittest.TestCase):
    def test_environment_override_takes_precedence(self) -> None:
        token, source = bridge_client.resolve_auth_token(
            profile_roots=[],
            environ={bridge_client.TOKEN_ENV: TOKEN},
        )
        self.assertEqual(token, TOKEN)
        self.assertEqual(source, "environment")

    def test_discovers_token_from_zotero_profile(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            profile = Path(directory) / "sample.default"
            profile.mkdir()
            (profile / "prefs.js").write_text(
                "user_pref(\"extensions.zotero.zotero-research-bridge."
                f"mcp.server.authToken\", \"{TOKEN}\");\n",
                encoding="utf-8",
            )

            token, source = bridge_client.resolve_auth_token(
                profile_roots=[Path(directory)],
                environ={},
            )

        self.assertEqual(token, TOKEN)
        self.assertEqual(source, "zotero-profile")

    def test_rejects_invalid_environment_token(self) -> None:
        with self.assertRaisesRegex(bridge_client.BridgeError, "invalid value"):
            bridge_client.resolve_auth_token(
                profile_roots=[],
                environ={bridge_client.TOKEN_ENV: "not-a-token"},
            )

    def test_missing_credentials_has_actionable_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(
                bridge_client.BridgeError,
                "Open Zotero once",
            ):
                bridge_client.resolve_auth_token(
                    profile_roots=[Path(directory)],
                    environ={},
                )


class SkillPortabilityTest(unittest.TestCase):
    def test_skill_uses_installed_root_instead_of_working_directory(self) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        api_reference = (SKILL_ROOT / "references" / "bridge-api.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("absolute directory containing this installed `SKILL.md`", skill)
        self.assertIn('"<skill-root>/scripts/bridge_client.py"', skill)
        self.assertIn('"<skill-root>/scripts/bridge_client.py"', api_reference)
        self.assertNotIn("python3 scripts/bridge_client.py", skill)
        self.assertNotIn("python3 scripts/bridge_client.py", api_reference)

    def test_skill_declares_map_first_optional_report_workflow(self) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        matching_template = (
            SKILL_ROOT / "references" / "matching-profile-template.md"
        ).read_text(encoding="utf-8")
        report_template = (
            SKILL_ROOT / "references" / "analysis-report-template.md"
        ).read_text(encoding="utf-8")

        self.assertIn("ZRB_MATCH_PROFILE_V1", skill)
        self.assertIn('"<skill-root>/scripts/validate_matching_profile.py"', skill)
        self.assertIn("always create or update", skill)
        self.assertIn("default reader-report option is `none`", skill)
        self.assertIn("Required: `map.json`", skill)
        self.assertIn("explicit user request", skill)
        self.assertIn("Do not generate a concise report", skill)
        self.assertIn("No `concise` production style", report_template)
        self.assertIn("Required filename: `map.json`", matching_template)
        self.assertNotIn('data-zrb-schema="ZRB_MATCH_PROFILE_V1"', matching_template)
        self.assertNotIn("produce two child notes", skill)

    def test_external_artifacts_keep_zotero_identity_and_two_file_maximum(
        self,
    ) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        report_template = (
            SKILL_ROOT / "references" / "analysis-report-template.md"
        ).read_text(encoding="utf-8")
        matching_template = (
            SKILL_ROOT / "references" / "matching-profile-template.md"
        ).read_text(encoding="utf-8")

        self.assertIn("<itemKey> - <Short Name>/map.json", skill)
        self.assertIn("<itemKey> - <Short Name>/analysis.html", skill)
        self.assertIn("at most one formal `analysis.html`", skill)
        self.assertIn("source.itemKey", matching_template)
        self.assertIn("source.attachmentKey", matching_template)
        self.assertIn("source.attachmentSha256", matching_template)
        self.assertIn("At most one formal `analysis.html`", report_template)
        self.assertIn("Supported styles: `academic` or `storytelling`", report_template)
        self.assertIn("formal item directory contains only", report_template)
        self.assertIn("Do not wrap the JSON in HTML", matching_template)
        self.assertIn('"transferableParts"', matching_template)

    def test_optional_report_uses_static_browser_math_and_handles_no_code(
        self,
    ) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        report_template = (
            SKILL_ROOT / "references" / "analysis-report-template.md"
        ).read_text(encoding="utf-8")

        self.assertIn('<math display="inline"', report_template)
        self.assertIn("pre-rendered KaTeX output", report_template)
        self.assertIn("no unresolved visible `$...$` or `$$...$$`", report_template)
        self.assertIn("without JavaScript or network access", report_template)
        self.assertIn("no runtime MathJax", report_template)
        self.assertIn("official`, `announced`, `unofficial`, or `none`", skill)
        self.assertIn("do not fabricate code snippets", skill)
        self.assertIn("do not invent or require code snippets", report_template)
        self.assertIn("Never present unofficial code", report_template)


if __name__ == "__main__":
    unittest.main()
