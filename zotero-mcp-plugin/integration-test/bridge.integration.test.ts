import { expect } from "chai";
import { BRIDGE_POLICY } from "../src/modules/bridgePolicy";
import {
  applyMutation,
  planMutation,
} from "../src/modules/mutationCoordinator";
import {
  RECOMMENDED_WORKFLOW_SCOPES,
  serverPreferences,
} from "../src/modules/serverPreferences";

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

    const longNotePlan = await request(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "plan_mutation",
          arguments: {
            operation: "add_note",
            arguments: {
              content: `<p>ZRB long UTF-8 request</p><p>${"时序知识图谱分析".repeat(1_000)}</p>`,
            },
          },
        },
      },
      token,
    );
    expect(longNotePlan.status).to.equal(200);
    const longNotePayload = JSON.parse(longNotePlan.responseText);
    const longNoteResult = JSON.parse(longNotePayload.result.content[0].text);
    expect(longNoteResult.risk).to.equal("low");
    expect(longNoteResult.preview.contentLength).to.be.greaterThan(4_096);

    let invalidMoveError: unknown;
    try {
      await planMutation({
        operation: "move_collection",
        arguments: {
          collectionKey: "ABCDEFGH",
          newParentCollectionKey: "HGFEDCBA",
        },
      });
    } catch (error) {
      invalidMoveError = error;
    }
    expect(invalidMoveError).to.be.instanceOf(Error);
    expect((invalidMoveError as Error).message).to.include(
      "Unexpected argument(s) for move_collection: newParentCollectionKey",
    );
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
    const auditAfterCreate = await IOUtils.readUTF8(createPlan.auditPath);
    expect(auditAfterCreate).not.to.include(title);
    expect(auditAfterCreate).not.to.include("zrb:integration-test");

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
          '<h1>Paper Analysis - Integration Test</h1><p><code>ZRB_ANALYSIS_V1:integration-test</code><br><code>ZRB_NOTE_FORMAT:deep-reading-v3</code></p><p>State <span class="math">$x_t$</span></p>',
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
          '<h1>Paper Analysis - Integration Test</h1><p><code>ZRB_ANALYSIS_V1:integration-test</code><br><code>ZRB_NOTE_FORMAT:deep-reading-v3</code></p><p>State <span class="math">$x_t$</span></p><pre class="math">$$\\begin{aligned} y_t &amp;= \\sum_i x_i \\\\ s_t &amp;= \\lVert y_t \\rVert_2 \\end{aligned}$$</pre><pre><code>for item in items:</code></pre>',
        tags: ["zrb:analysis", "zrb:analyzer:integration-test"],
      },
    });
    await applyMutation({
      planId: updateNotePlan.planId,
      confirmationToken: updateNotePlan.confirmationToken,
    });

    const updatedNote = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      noteKey,
    );
    const storedNote = updatedNote.getNote();
    expect(updatedNote.getNoteTitle()).to.equal(
      "Paper Analysis - Integration Test",
    );
    expect(storedNote).to.include('<span class="math">$x_t$</span>');
    expect(storedNote).to.include('<pre class="math">$$\\begin{aligned}');
    expect(storedNote).to.include("&amp;=");
    expect(storedNote).to.include("\\sum_i");
    expect(storedNote).to.include("\\lVert y_t \\rVert_2");
    expect(storedNote).to.include("<pre><code>for item in items:</code></pre>");

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

    const analysisPath = PathUtils.join(
      Zotero.DataDirectory.dir,
      "zrb-integration-analysis.html",
    );
    await IOUtils.writeUTF8(
      analysisPath,
      "<!doctype html><html><head><title>Analysis</title></head><body><h1>Paper Analysis - Integration Test</h1></body></html>",
      { mode: "overwrite" },
    );
    try {
      const linkPlan = await planMutation({
        operation: "link_analysis_file",
        arguments: {
          sourcePath: analysisPath,
          parentItemKey: itemKey,
          title: "Paper Analysis - Integration Test",
        },
      });
      expect(linkPlan.risk).to.equal("low");
      expect(linkPlan.preview.decision).to.equal("link");
      expect(linkPlan.preview.sha256).to.match(/^[a-f0-9]{64}$/);
      const linked = await applyMutation({
        planId: linkPlan.planId,
        confirmationToken: linkPlan.confirmationToken,
      });
      expect(linked.itemKey).to.match(/^[A-Z0-9]{8}$/);
      const linkedItem = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        linked.itemKey,
      );
      expect(linkedItem.isLinkedFileAttachment()).to.equal(true);
      expect(await linkedItem.getFilePathAsync()).to.equal(analysisPath);

      const duplicateLinkPlan = await planMutation({
        operation: "link_analysis_file",
        arguments: {
          sourcePath: analysisPath,
          parentItemKey: itemKey,
          title: "Paper Analysis - Integration Test",
        },
      });
      expect(duplicateLinkPlan.preview.decision).to.equal("skip");
      const duplicateLink = await applyMutation({
        planId: duplicateLinkPlan.planId,
        confirmationToken: duplicateLinkPlan.confirmationToken,
      });
      expect(duplicateLink.details.skipped).to.equal(true);
      expect(duplicateLink.itemKey).to.equal(linked.itemKey);
    } finally {
      if (await IOUtils.exists(analysisPath)) {
        await IOUtils.remove(analysisPath);
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

  it("enables the conversational workflow without destructive scopes", function () {
    Zotero.Prefs.set(
      "extensions.zotero.zotero-research-bridge.mcp.write.delete",
      true,
      true,
    );
    Zotero.Prefs.set(
      "extensions.zotero.zotero-research-bridge.mcp.write.bulk",
      true,
      true,
    );

    serverPreferences.enableRecommendedWorkflowScopes();

    for (const scope of RECOMMENDED_WORKFLOW_SCOPES) {
      expect(serverPreferences.isScopeEnabled(scope)).to.equal(true);
    }
    expect(serverPreferences.isScopeEnabled("delete")).to.equal(false);
    expect(serverPreferences.isScopeEnabled("bulk")).to.equal(false);
    expect(serverPreferences.hasRecommendedWorkflowScopes()).to.equal(true);
  });
});
