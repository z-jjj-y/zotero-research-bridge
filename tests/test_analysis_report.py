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
    / "validate_analysis_report.py"
)
SPEC = importlib.util.spec_from_file_location("zrb_analysis_report", SCRIPT_PATH)
assert SPEC and SPEC.loader
analysis_report = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analysis_report)


def valid_report() -> str:
    return """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Paper Analysis - Example</title>
  <style>body { color: #222; }</style>
</head>
<body>
  <h1>Paper Analysis - Example</h1>
  <p>Item key: ABCDEFGH; attachment key: HGFEDCBA.</p>
  <p>浏览器可以离线显示下式。</p>
  <math display="block" aria-label="x sub t">
    <msub><mi>x</mi><mi>t</mi></msub>
  </math>
  <img alt="embedded figure" src="data:image/png;base64,AA==">
  <a href="https://example.org/paper">Paper source</a>
</body>
</html>"""


class AnalysisReportValidationTest(unittest.TestCase):
    def test_accepts_static_embedded_report_and_external_anchor(self) -> None:
        errors = analysis_report.validate_report(
            valid_report(),
            item_key="ABCDEFGH",
            attachment_key="HGFEDCBA",
            min_math=1,
            min_paragraphs=2,
        )
        self.assertEqual(errors, [])

    def test_rejects_runtime_script_and_remote_image(self) -> None:
        report = valid_report().replace(
            "</body>",
            '<script src="https://cdn.jsdelivr.net/katex.min.js"></script>'
            '<img src="https://example.org/figure.png"></body>',
        )
        errors = analysis_report.validate_report(report)
        self.assertTrue(any("script elements" in error for error in errors))
        self.assertTrue(any("non-embedded resources" in error for error in errors))
        self.assertTrue(any("katex.min.js" in error for error in errors))

    def test_rejects_visible_unresolved_latex_but_ignores_code(self) -> None:
        report = valid_report().replace(
            "浏览器可以离线显示下式。",
            "未解析公式 $x_t$。<code>$shell_variable</code>",
        )
        errors = analysis_report.validate_report(report)
        self.assertTrue(any("dollar delimiters" in error for error in errors))

    def test_rejects_external_stylesheet_and_remote_css_import(self) -> None:
        report = valid_report().replace(
            "<style>body { color: #222; }</style>",
            '<link rel="stylesheet" href="https://example.org/site.css">'
            '<style>@import url("https://example.org/math.css");</style>',
        )
        errors = analysis_report.validate_report(report)
        self.assertTrue(any("non-embedded resources" in error for error in errors))
        self.assertTrue(any("remote resources" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
