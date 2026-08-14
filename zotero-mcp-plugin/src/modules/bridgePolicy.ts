/**
 * Security properties that local preferences must never be able to weaken.
 * Keep these values independent from Zotero.Prefs so stale settings from an
 * older plugin version cannot expand the bridge's network exposure.
 */
export const BRIDGE_POLICY = Object.freeze({
  addonID: "zotero-research-bridge@local.litzeng",
  defaultPort: 23121,
  updateManifestURL: "https://127.0.0.1:1/zrb-no-updates.json",
  loopbackOnly: true,
  remoteAccessAllowed: false,
  authenticationRequired: true,
});
