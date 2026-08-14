import { expect } from "chai";
import { BRIDGE_POLICY } from "../src/modules/bridgePolicy";

describe("bridge security policy", function () {
  it("is loopback-only and always authenticated", function () {
    expect(BRIDGE_POLICY.loopbackOnly).to.equal(true);
    expect(BRIDGE_POLICY.remoteAccessAllowed).to.equal(false);
    expect(BRIDGE_POLICY.authenticationRequired).to.equal(true);
  });

  it("uses a port separate from the upstream plugin", function () {
    expect(BRIDGE_POLICY.defaultPort).to.equal(23121);
  });

  it("uses an unreachable loopback-only update URL", function () {
    const updateURL = new URL(BRIDGE_POLICY.updateManifestURL);
    expect(updateURL.protocol).to.equal("https:");
    expect(updateURL.hostname).to.equal("127.0.0.1");
    expect(updateURL.port).to.equal("1");
  });

  it("cannot be mutated at runtime", function () {
    expect(Object.isFrozen(BRIDGE_POLICY)).to.equal(true);
  });
});
