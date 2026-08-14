# Update Policy

## Current policy

Zotero Research Bridge v0.1.0 intentionally disables automatic add-on updates.

The add-on controls authenticated write access to a user's Zotero library. A compromised or accidentally published update therefore has a larger impact than an ordinary read-only extension. Until the release and signing process is mature, users should review and install release artifacts manually.

The production build uses an unreachable loopback update-manifest URL and does not embed a downloadable XPI URL. This is enforced by `src/modules/bridgePolicy.ts` and covered by unit tests.

## Manual upgrade

1. Open the release page for `z-jjj-y/zotero-research-bridge`.
2. Download `zotero-research-bridge.xpi` and `SHA256SUMS.txt`.
3. Verify the checksum:

   ```bash
   shasum -a 256 zotero-research-bridge.xpi
   ```

4. Compare the output with `SHA256SUMS.txt`.
5. Back up important Zotero data.
6. In Zotero, open **Tools → Add-ons → Install Add-on From File…**.
7. Install the XPI and restart Zotero if prompted.
8. Verify authenticated read access before re-enabling write scopes.

## Release process

A `vX.Y.Z` tag triggers `.github/workflows/release.yml`. The workflow:

1. installs dependencies with `npm ci`;
2. runs unit tests and static checks;
3. builds the production XPI;
4. verifies that the tag matches `package.json`;
5. generates `SHA256SUMS.txt`;
6. publishes both files in a GitHub Release.

## Conditions for enabling automatic updates later

Automatic updates should remain disabled until the project has:

- a stable add-on identity and update URL;
- protected release branches and tags;
- a reviewed, least-privilege GitHub Actions workflow;
- reproducible or independently verifiable build artifacts;
- a documented rollback path;
- integration tests for upgrades that preserve preferences and write scopes;
- an incident-response process for compromised releases.

Enabling automatic updates requires a deliberate policy change, new tests, and a release migration plan. It should not be done by editing only the manifest URL.
