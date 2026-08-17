#!/usr/bin/env python3
"""Validate a portable, static ZRB external analysis HTML report."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


RAW_MATH = re.compile(r"(?<!\\)\$\$?.+?\$\$?", re.DOTALL)
REMOTE_URL = re.compile(r"(?:https?:)?//", re.IGNORECASE)
FORBIDDEN_RUNTIME_MARKERS = (
    "mathjax",
    "katex.min.js",
    "auto-render.min.js",
    "mermaid.min.js",
    "cdn.jsdelivr",
    "unpkg.com",
)


class ReportParser(HTMLParser):
    """Collect structural and visible-text facts without executing HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: list[str] = []
        self.math_count = 0
        self.paragraph_count = 0
        self.has_title = False
        self.has_h1 = False
        self.has_inline_style = False
        self.has_script = False
        self.external_resources: list[str] = []
        self.visible_text: list[str] = []
        self._ignored_depth = 0
        self._ignored_tags = {"code", "math", "pre", "script", "style", "svg"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_dict = {name.lower(): value or "" for name, value in attrs}
        self.tags.append(tag)
        if tag in self._ignored_tags:
            self._ignored_depth += 1
        if tag == "math":
            self.math_count += 1
        elif tag == "p":
            self.paragraph_count += 1
        elif tag == "title":
            self.has_title = True
        elif tag == "h1":
            self.has_h1 = True
        elif tag == "style":
            self.has_inline_style = True
        elif tag == "script":
            self.has_script = True

        if tag == "link" and "stylesheet" in attrs_dict.get("rel", "").lower():
            href = attrs_dict.get("href", "")
            if href:
                self.external_resources.append(f"link:{href}")
        if tag in {"img", "audio", "video", "source", "iframe"}:
            source = attrs_dict.get("src", "")
            if source and not source.startswith("data:"):
                self.external_resources.append(f"{tag}:{source}")
        if tag == "video":
            poster = attrs_dict.get("poster", "")
            if poster and not poster.startswith("data:"):
                self.external_resources.append(f"video-poster:{poster}")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() in self._ignored_tags:
            self._ignored_depth -= 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self._ignored_tags and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth and data.strip():
            self.visible_text.append(data)


def validate_report(
    html: str,
    *,
    item_key: str | None = None,
    attachment_key: str | None = None,
    min_math: int = 1,
    min_paragraphs: int = 1,
) -> list[str]:
    errors: list[str] = []
    if not re.match(r"\s*<!doctype\s+html", html, re.IGNORECASE):
        errors.append("report must begin with an HTML doctype")
    parser = ReportParser()
    try:
        parser.feed(html)
        parser.close()
    except Exception as error:  # HTMLParser failures are rare but actionable.
        errors.append(f"report HTML could not be parsed: {error}")
        return errors

    if "html" not in parser.tags:
        errors.append("report must contain an html element")
    if not parser.has_title:
        errors.append("report must contain a title element")
    if not parser.has_h1:
        errors.append("report must contain a visible h1 heading")
    if not parser.has_inline_style:
        errors.append("report must contain embedded CSS in a style element")
    if parser.has_script:
        errors.append("report must not contain script elements")
    if parser.external_resources:
        errors.append(
            "report has non-embedded resources: " + ", ".join(parser.external_resources)
        )
    if parser.math_count < min_math:
        errors.append(
            f"report must contain at least {min_math} static math elements; "
            f"found {parser.math_count}"
        )
    if parser.paragraph_count < min_paragraphs:
        errors.append(
            f"report must contain at least {min_paragraphs} paragraphs; "
            f"found {parser.paragraph_count}"
        )

    visible_text = " ".join(parser.visible_text)
    if RAW_MATH.search(visible_text):
        errors.append("report contains unresolved visible LaTeX dollar delimiters")
    lower_html = html.lower()
    for marker in FORBIDDEN_RUNTIME_MARKERS:
        if marker in lower_html:
            errors.append(f"report contains forbidden runtime dependency marker: {marker}")
    for style_block in re.findall(r"<style\b[^>]*>(.*?)</style>", html, re.I | re.S):
        if "@import" in style_block.lower() or REMOTE_URL.search(style_block):
            errors.append("embedded CSS must not import remote resources")
            break
    if item_key and item_key not in html:
        errors.append(f"report does not contain Zotero item key {item_key}")
    if attachment_key and attachment_key not in html:
        errors.append(f"report does not contain Zotero attachment key {attachment_key}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--item-key")
    parser.add_argument("--attachment-key")
    parser.add_argument("--min-math", type=int, default=1)
    parser.add_argument("--min-paragraphs", type=int, default=1)
    args = parser.parse_args()
    try:
        html = args.report.read_text(encoding="utf-8")
    except OSError as error:
        print(f"invalid report input: {error}", file=sys.stderr)
        return 2
    errors = validate_report(
        html,
        item_key=args.item_key,
        attachment_key=args.attachment_key,
        min_math=args.min_math,
        min_paragraphs=args.min_paragraphs,
    )
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(
        "static analysis HTML valid "
        f"(math>={args.min_math}, paragraphs>={args.min_paragraphs})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
