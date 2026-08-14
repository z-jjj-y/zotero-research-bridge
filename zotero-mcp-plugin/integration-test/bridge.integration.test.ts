import { expect } from "chai";
import { BRIDGE_POLICY } from "../src/modules/bridgePolicy";
import {
  applyMutation,
  planMutation,
} from "../src/modules/mutationCoordinator";
import { serverPreferences } from "../src/modules/serverPreferences";

describe("Zotero Research Bridge integration", function () {
  it("requires authentication and exposes only the plan/apply write gateway", async function () {
    const endpoint = `http://127.0.0.1:${serverPreferences.getPort()}/mcp`;
    const request = (body: Record<string, any>, token?: string) =>
      Zotero.HTTP.request("POST", endpoint, {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
                "X-Zotero-MCP-Token": token,
              }
            : {}),
        },
        successCodes: false,
        timeout: 5_000,
      });

    const unauthenticated = await request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(unauthenticated.status).to.equal(401);

    const token = serverPreferences.ensureAuthToken();
    const persistedToken = Zotero.Prefs.get(
      "extensions.zotero.zotero-research-bridge.mcp.server.authToken",
      true,
    ) as string;
    expect(token).to.match(/^zmcp_[a-f0-9]{48}$/);
    expect(persistedToken).to.equal(token);

    const toolResponse = await request(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      token,
    );
    expect(toolResponse.status).to.equal(200);
    const payload = JSON.parse(toolResponse.responseText);
    const names = payload.result.tools.map((tool: any) => tool.name);
    expect(names).to.include("plan_mutation");
    expect(names).to.include("apply_mutation");
    expect(names).not.to.include("update_item");
    expect(names).not.to.include("delete_collection");
    expect(names).not.to.include("delete_tag");

    const directMutation = await request(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "update_item",
          arguments: {
            itemKey: "ABCDEFGH",
            fields: { title: "must not run" },
          },
        },
      },
      token,
    );
    const directPayload = JSON.parse(directMutation.responseText);
    expect(directPayload.error.code).to.equal(-32602);
    expect(directPayload.error.message).to.include("Direct mutation tool");
  });

  it("runs an audited create, update, note, PDF, trash, and restore lifecycle", async function () {
    expect(BRIDGE_POLICY.loopbackOnly).to.equal(true);
    expect(BRIDGE_POLICY.authenticationRequired).to.equal(true);

    const title = `ZRB integration ${Date.now()}`;
    const createPlan = await planMutation({
      operation: "create_item",
      arguments: {
        itemType: "journalArticle",
        fields: { title, date: "2026" },
        tags: ["zrb:integration-test"],
      },
    });
    const created = await applyMutation({
      planId: createPlan.planId,
      confirmationToken: createPlan.confirmationToken,
    });
    const itemKey = created.itemKey as string;
    expect(itemKey).to.match(/^[A-Z0-9]{8}$/);
    expect(await IOUtils.exists(createPlan.auditPath)).to.equal(true);

    const updatePlan = await planMutation({
      operation: "update_item",
      arguments: {
        itemKey,
        fields: { abstractNote: "Integration-test abstract" },
      },
    });
    expect(updatePlan.preview.fieldChanges.abstractNote.before).to.equal("");
    await applyMutation({
      planId: updatePlan.planId,
      confirmationToken: updatePlan.confirmationToken,
    });

    const notePlan = await planMutation({
      operation: "add_note",
      arguments: {
        itemKey,
        content:
          "<p>ZRB_ANALYSIS_V1:integration-test</p><h1>Structured analysis</h1>",
        tags: ["zrb:analysis", "zrb:analyzer:integration-test"],
      },
    });
    const noteResult = await applyMutation({
      planId: notePlan.planId,
      confirmationToken: notePlan.confirmationToken,
    });
    const noteKey = noteResult.itemKey as string;
    expect(noteKey).to.match(/^[A-Z0-9]{8}$/);

    const updateNotePlan = await planMutation({
      operation: "update_note",
      arguments: {
        noteKey,
        content:
          "<p>ZRB_ANALYSIS_V1:integration-test</p><h1>Updated analysis</h1>",
        tags: ["zrb:analysis", "zrb:analyzer:integration-test"],
      },
    });
    await applyMutation({
      planId: updateNotePlan.planId,
      confirmationToken: updateNotePlan.confirmationToken,
    });

    const sourcePath = PathUtils.join(
      Zotero.DataDirectory.dir,
      "zrb-integration-paper.pdf",
    );
    await IOUtils.writeUTF8(
      sourcePath,
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
      { mode: "overwrite" },
    );
    try {
      const importPlan = await planMutation({
        operation: "import_attachment_file",
        arguments: { sourcePath, parentItemKey: itemKey, ifExists: "skip" },
      });
      expect(importPlan.preview.decision).to.equal("create");
      expect(importPlan.preview.sha256).to.match(/^[a-f0-9]{64}$/);
      const imported = await applyMutation({
        planId: importPlan.planId,
        confirmationToken: importPlan.confirmationToken,
      });
      expect(imported.itemKey).to.match(/^[A-Z0-9]{8}$/);

      const duplicatePlan = await planMutation({
        operation: "import_attachment_file",
        arguments: { sourcePath, parentItemKey: itemKey, ifExists: "skip" },
      });
      expect(duplicatePlan.preview.decision).to.equal("skip");
      const duplicate = await applyMutation({
        planId: duplicatePlan.planId,
        confirmationToken: duplicatePlan.confirmationToken,
      });
      expect(duplicate.details.skipped).to.equal(true);
    } finally {
      if (await IOUtils.exists(sourcePath)) {
        await IOUtils.remove(sourcePath);
      }
    }

    const trashPlan = await planMutation({
      operation: "trash_item",
      arguments: { itemKey },
    });
    await applyMutation({
      planId: trashPlan.planId,
      confirmationToken: trashPlan.confirmationToken,
    });
    const trashed = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      itemKey,
    );
    expect(Boolean(trashed.deleted)).to.equal(true);

    const restorePlan = await planMutation({
      operation: "restore_from_trash",
      arguments: { itemKey },
    });
    await applyMutation({
      planId: restorePlan.planId,
      confirmationToken: restorePlan.confirmationToken,
    });
    expect(Boolean(trashed.deleted)).to.equal(false);
  });
});
