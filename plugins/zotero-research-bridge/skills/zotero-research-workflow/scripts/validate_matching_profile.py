#!/usr/bin/env python3
"""Validate a ZRB_MATCH_PROFILE_V1 JSON document."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


PROBLEM_STATUSES = {"addressed", "partially-addressed", "open", "unclear"}
METHOD_LEVELS = {
    "framework",
    "module",
    "representation",
    "objective",
    "training-strategy",
    "inference",
    "evaluation",
}
RELATIONSHIPS = {"solves", "mitigates", "supports", "evaluates"}
EVIDENCE_BASES = {"author-stated", "system-inferred"}
CONFIDENCE_LEVELS = {"high", "medium", "low"}


def _object(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return {}
    return value


def _array(value: Any, path: str, errors: list[str]) -> list[Any]:
    if not isinstance(value, list):
        errors.append(f"{path} must be an array")
        return []
    return value


def _string(value: Any, path: str, errors: list[str]) -> str:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path} must be a non-empty string")
        return ""
    return value.strip()


def _string_array(value: Any, path: str, errors: list[str]) -> list[str]:
    values = _array(value, path, errors)
    for index, entry in enumerate(values):
        _string(entry, f"{path}[{index}]", errors)
    return values


def _choice(value: Any, allowed: set[str], path: str, errors: list[str]) -> str:
    selected = _string(value, path, errors)
    if selected and selected not in allowed:
        errors.append(f"{path} must be one of: {', '.join(sorted(allowed))}")
    return selected


def _evidence(value: Any, path: str, errors: list[str]) -> None:
    records = _array(value, path, errors)
    if not records:
        errors.append(f"{path} must contain at least one evidence record")
    for index, raw_record in enumerate(records):
        record_path = f"{path}[{index}]"
        record = _object(raw_record, record_path, errors)
        _string(record.get("locator"), f"{record_path}.locator", errors)
        _choice(
            record.get("basis"),
            EVIDENCE_BASES,
            f"{record_path}.basis",
            errors,
        )
        _choice(
            record.get("confidence"),
            CONFIDENCE_LEVELS,
            f"{record_path}.confidence",
            errors,
        )
        _string(record.get("summary"), f"{record_path}.summary", errors)


def validate_profile(profile: Any) -> list[str]:
    errors: list[str] = []
    root = _object(profile, "$", errors)
    if root.get("schema") != "ZRB_MATCH_PROFILE_V1":
        errors.append("$.schema must equal ZRB_MATCH_PROFILE_V1")
    _string(root.get("generatedAt"), "$.generatedAt", errors)

    source = _object(root.get("source"), "$.source", errors)
    _string(source.get("itemKey"), "$.source.itemKey", errors)
    _string(source.get("attachmentKey"), "$.source.attachmentKey", errors)
    attachment_hash = source.get("attachmentSha256")
    if attachment_hash is not None:
        hash_text = _string(
            attachment_hash,
            "$.source.attachmentSha256",
            errors,
        )
        if hash_text and (
            len(hash_text) != 64
            or any(character not in "0123456789abcdefABCDEF" for character in hash_text)
        ):
            errors.append("$.source.attachmentSha256 must be a 64-character hex digest or null")
    _string(source.get("title"), "$.source.title", errors)

    problems = _array(root.get("problems"), "$.problems", errors)
    methods = _array(root.get("methods"), "$.methods", errors)
    if not problems:
        errors.append("$.problems must contain at least one problem card")
    if not methods:
        errors.append("$.methods must contain at least one method card")

    problem_ids: set[str] = set()
    for index, raw_problem in enumerate(problems):
        path = f"$.problems[{index}]"
        problem = _object(raw_problem, path, errors)
        problem_id = _string(problem.get("id"), f"{path}.id", errors)
        if problem_id in problem_ids:
            errors.append(f"{path}.id duplicates {problem_id}")
        problem_ids.add(problem_id)
        for field in ("statement", "rootCause"):
            _string(problem.get(field), f"{path}.{field}", errors)
        for field in ("context", "constraints", "requiredCapabilities"):
            _string_array(problem.get(field), f"{path}.{field}", errors)
        _choice(problem.get("status"), PROBLEM_STATUSES, f"{path}.status", errors)
        _evidence(problem.get("evidence"), f"{path}.evidence", errors)

    method_ids: set[str] = set()
    for index, raw_method in enumerate(methods):
        path = f"$.methods[{index}]"
        method = _object(raw_method, path, errors)
        method_id = _string(method.get("id"), f"{path}.id", errors)
        if method_id in method_ids:
            errors.append(f"{path}.id duplicates {method_id}")
        method_ids.add(method_id)
        for field in ("name", "purpose", "mechanism", "complexity"):
            _string(method.get(field), f"{path}.{field}", errors)
        _choice(method.get("level"), METHOD_LEVELS, f"{path}.level", errors)
        for field in (
            "inputs",
            "outputs",
            "assumptions",
            "validatedEffects",
            "transferableParts",
            "incompatibilities",
        ):
            _string_array(method.get(field), f"{path}.{field}", errors)
        _evidence(method.get("evidence"), f"{path}.evidence", errors)

    matches = _array(root.get("internalMatches"), "$.internalMatches", errors)
    for index, raw_match in enumerate(matches):
        path = f"$.internalMatches[{index}]"
        match = _object(raw_match, path, errors)
        problem_id = _string(match.get("problemId"), f"{path}.problemId", errors)
        method_id = _string(match.get("methodId"), f"{path}.methodId", errors)
        if problem_id and problem_id not in problem_ids:
            errors.append(f"{path}.problemId references unknown problem {problem_id}")
        if method_id and method_id not in method_ids:
            errors.append(f"{path}.methodId references unknown method {method_id}")
        _choice(
            match.get("relationship"),
            RELATIONSHIPS,
            f"{path}.relationship",
            errors,
        )
        _string(match.get("mechanismFit"), f"{path}.mechanismFit", errors)
        _string_array(
            match.get("adaptationRequired"),
            f"{path}.adaptationRequired",
            errors,
        )
        _evidence(match.get("evidence"), f"{path}.evidence", errors)

    _string_array(root.get("openQuestions"), "$.openQuestions", errors)
    _string_array(root.get("uncertainties"), "$.uncertainties", errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    args = parser.parse_args()
    try:
        profile = json.loads(args.profile.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"invalid profile input: {error}", file=sys.stderr)
        return 2
    errors = validate_profile(profile)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print("ZRB_MATCH_PROFILE_V1 valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

