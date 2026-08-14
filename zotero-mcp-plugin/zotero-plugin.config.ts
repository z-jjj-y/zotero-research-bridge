import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { BRIDGE_POLICY } from "./src/modules/bridgePolicy";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: BRIDGE_POLICY.updateManifestURL,
  xpiDownloadLink: "",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  server: {
    devtools: false,
  },

  test: {
    entries: "integration-test",
    prefs: {
      [`${pkg.config.prefsPrefix}.mcp.server.port`]: 24121,
      [`${pkg.config.prefsPrefix}.mcp.server.authToken`]:
        "zmcp_000000000000000000000000000000000000000000000000",
      [`${pkg.config.prefsPrefix}.mcp.write.notes`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.tags`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.collections`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.metadata`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.delete`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.bulk`]: true,
      [`${pkg.config.prefsPrefix}.mcp.write.import`]: true,
    },
    mocha: { timeout: 30_000 },
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
