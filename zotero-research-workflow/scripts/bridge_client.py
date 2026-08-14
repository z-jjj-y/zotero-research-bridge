#!/usr/bin/env python3
"""Minimal loopback-only MCP client for Zotero Research Bridge."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


DEFAULT_ENDPOINT = "http://127.0.0.1:23121/mcp"
TOKEN_ENV = "ZOTERO_RESEARCH_BRIDGE_TOKEN"
ENDPOINT_ENV = "ZOTERO_RESEARCH_BRIDGE_URL"
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


class BridgeError(RuntimeError):
    pass


def validate_endpoint(endpoint: str) -> str:
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme != "http" or parsed.hostname not in LOOPBACK_HOSTS:
        raise BridgeError("Bridge endpoint must be an HTTP loopback address")
    if parsed.path.rstrip("/") != "/mcp":
        raise BridgeError("Bridge endpoint path must be /mcp")
    return endpoint


def parse_response(body: str, content_type: str) -> Any:
    if not body.strip():
        return None
    if "text/event-stream" in content_type:
        data_lines = [
            line[5:].strip()
            for line in body.splitlines()
            if line.startswith("data:")
        ]
        if not data_lines:
            raise BridgeError("MCP server returned an empty event stream")
        body = data_lines[-1]
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise BridgeError(f"MCP server returned invalid JSON: {exc}") from exc


class BridgeClient:
    def __init__(self, endpoint: str, token: str, timeout: float = 30.0):
        self.endpoint = validate_endpoint(endpoint)
        self.token = token
        self.timeout = timeout
        self.session_id: str | None = None
        self.next_id = 1

    def _post(self, payload: dict[str, Any]) -> Any:
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "Zotero-Research-Workflow/0.1",
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        request = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                session_id = response.headers.get("Mcp-Session-Id")
                if session_id:
                    self.session_id = session_id
                body = response.read().decode("utf-8")
                return parse_response(body, response.headers.get("Content-Type", ""))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise BridgeError(f"Bridge HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise BridgeError(f"Could not connect to Zotero Research Bridge: {exc}") from exc

    def _request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        request_id = self.next_id
        self.next_id += 1
        response = self._post(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params or {},
            }
        )
        if isinstance(response, dict) and response.get("error"):
            raise BridgeError(json.dumps(response["error"], ensure_ascii=False))
        return response.get("result") if isinstance(response, dict) else response

    def initialize(self) -> None:
        self._request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {
                    "name": "zotero-research-workflow",
                    "version": "0.1.0",
                },
            },
        )
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def list_tools(self) -> Any:
        return self._request("tools/list")

    def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        result = self._request(
            "tools/call", {"name": name, "arguments": arguments}
        )
        if isinstance(result, dict) and result.get("isError"):
            text = result.get("content", [{}])[0].get("text", "Tool call failed")
            raise BridgeError(text)
        return result


def load_arguments(args: argparse.Namespace) -> dict[str, Any]:
    if args.args_file:
        value = json.loads(Path(args.args_file).read_text(encoding="utf-8"))
    else:
        value = json.loads(args.args_json or "{}")
    if not isinstance(value, dict):
        raise BridgeError("Tool arguments must be a JSON object")
    return value


def ping(endpoint: str, timeout: float) -> str:
    parsed = urllib.parse.urlparse(validate_endpoint(endpoint))
    ping_url = urllib.parse.urlunparse(parsed._replace(path="/ping"))
    try:
        with urllib.request.urlopen(ping_url, timeout=timeout) as response:
            return response.read().decode("utf-8")
    except urllib.error.URLError as exc:
        raise BridgeError(f"Could not connect to Zotero Research Bridge: {exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--endpoint", default=os.environ.get(ENDPOINT_ENV, DEFAULT_ENDPOINT)
    )
    parser.add_argument("--timeout", type=float, default=30.0)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("ping")
    subparsers.add_parser("list-tools")

    call = subparsers.add_parser("call")
    call.add_argument("tool_name")
    call_args = call.add_mutually_exclusive_group()
    call_args.add_argument("--args-json")
    call_args.add_argument("--args-file")

    plan = subparsers.add_parser("plan")
    plan.add_argument("operation")
    plan_args = plan.add_mutually_exclusive_group()
    plan_args.add_argument("--args-json")
    plan_args.add_argument("--args-file")

    apply = subparsers.add_parser("apply")
    apply.add_argument("plan_id")
    apply.add_argument("confirmation_token")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "ping":
            print(ping(args.endpoint, args.timeout))
            return 0

        token = os.environ.get(TOKEN_ENV, "")
        if not token:
            raise BridgeError(f"Set {TOKEN_ENV} before making authenticated calls")
        client = BridgeClient(args.endpoint, token, args.timeout)
        client.initialize()
        if args.command == "list-tools":
            result = client.list_tools()
        elif args.command == "call":
            result = client.call_tool(args.tool_name, load_arguments(args))
        elif args.command == "plan":
            result = client.call_tool(
                "plan_mutation",
                {"operation": args.operation, "arguments": load_arguments(args)},
            )
        else:
            result = client.call_tool(
                "apply_mutation",
                {
                    "planId": args.plan_id,
                    "confirmationToken": args.confirmation_token,
                },
            )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (BridgeError, json.JSONDecodeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
