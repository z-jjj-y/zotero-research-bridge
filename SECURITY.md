# Security Policy

## Supported versions

Security fixes currently target the latest release on the `main` branch.

| Version                   | Supported |
| ------------------------- | --------- |
| 0.1.x                     | Yes       |
| Earlier upstream releases | No        |

## Reporting a vulnerability

Please use the repository's private GitHub Security Advisory reporting flow. Do not open a public issue for an unpatched vulnerability, and never include real Zotero data, bearer tokens, API keys, profile archives, or audit logs in a report.

A useful report includes:

- affected version and Zotero version;
- operating system;
- a minimal reproduction using synthetic data;
- expected and observed behavior;
- potential impact;
- a proposed fix, if available.

## Security invariants

Changes must preserve these properties:

- the bridge listens only on loopback;
- MCP requests require bearer authentication;
- write scopes are disabled by default;
- mutation arguments are planned and stored server-side before apply;
- confirmation tokens expire and are single-use;
- permanent deletion and arbitrary JavaScript execution remain unavailable;
- the plugin never writes directly to `zotero.sqlite`;
- audit records redact note bodies, metadata values, tokens, and local source directories.
- the bundled Codex helper reads the bridge token only from bounded Zotero profile locations, never writes the profile, and never prints the token.

## Local deployment guidance

- Keep Zotero and the add-on updated from trusted release artifacts.
- Enable only the write scopes required for the current workflow.
- Regenerate the bearer token if it may have been exposed.
- Review mutation previews before applying them.
- Back up important Zotero libraries before testing a new release.
- Do not expose port `23121` through a reverse proxy, tunnel, container port mapping, or firewall rule.
