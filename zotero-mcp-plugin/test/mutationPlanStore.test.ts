import { expect } from "chai";
import {
  redactMutationArguments,
  redactMutationDetails,
} from "../src/modules/mutationAuditLog";
import {
  isLegacyDirectMutationTool,
  isMutationOperation,
  MUTATION_OPERATIONS,
} from "../src/modules/mutationOperations";
import { MutationPlanStore } from "../src/modules/mutationPlanStore";

function draft() {
  return {
    operation: "update_item" as const,
    arguments: {
      itemKey: "ABCDEFGH",
      fields: { title: "New title" },
    },
    summary: "Update an item",
    risk: "medium" as const,
    requiredScopes: ["metadata" as const],
    preview: { title: { before: "Old title", after: "New title" } },
  };
}

describe("mutation safety foundation", function () {
  describe("MutationPlanStore", function () {
    it("stores exact arguments server-side and returns a reviewable view", function () {
      const store = new MutationPlanStore({
        now: () => 1_000,
        randomHex: (bytes) => "a".repeat(bytes * 2),
      });
      const plan = store.create(draft());
      expect(plan).not.to.have.property("arguments");
      expect(plan.planId).to.match(/^plan_/);
      expect(plan.confirmationToken).to.match(/^confirm_/);
      expect(plan.preview).to.deep.equal(draft().preview);
    });

    it("does not depend on structuredClone in the Zotero plugin scope", function () {
      const original = globalThis.structuredClone;
      (globalThis as any).structuredClone = undefined;
      try {
        const store = new MutationPlanStore({
          randomHex: (bytes) => "d".repeat(bytes * 2),
        });
        const input = draft();
        const plan = store.create(input);
        input.preview.title.after = "Changed after planning";
        expect(plan.preview.title.after).to.equal("New title");
      } finally {
        globalThis.structuredClone = original;
      }
    });

    it("requires the one-time confirmation token", function () {
      const store = new MutationPlanStore({
        randomHex: (bytes) => "b".repeat(bytes * 2),
      });
      const plan = store.create(draft());
      expect(() => store.consume(plan.planId, "wrong")).to.throw(
        "Invalid mutation confirmation token",
      );
      const consumed = store.consume(plan.planId, plan.confirmationToken);
      expect(consumed.arguments.fields.title).to.equal("New title");
      expect(() => store.consume(plan.planId, plan.confirmationToken)).to.throw(
        "not found or expired",
      );
    });

    it("expires plans", function () {
      let now = 0;
      const store = new MutationPlanStore({
        ttlMs: 100,
        now: () => now,
        randomHex: (bytes) => "c".repeat(bytes * 2),
      });
      const plan = store.create(draft());
      now = 101;
      expect(() => store.consume(plan.planId, plan.confirmationToken)).to.throw(
        "not found or expired",
      );
    });
  });

  describe("mutation allowlist", function () {
    it("contains recoverable trash but excludes permanent collection deletion", function () {
      expect(MUTATION_OPERATIONS).to.include("trash_item");
      expect(MUTATION_OPERATIONS).to.include("restore_from_trash");
      expect(MUTATION_OPERATIONS).not.to.include("delete_collection" as any);
      expect(MUTATION_OPERATIONS).not.to.include("delete_tag" as any);
    });

    it("blocks legacy direct mutation calls", function () {
      expect(isMutationOperation("update_item")).to.equal(true);
      expect(isLegacyDirectMutationTool("update_item")).to.equal(true);
      expect(isLegacyDirectMutationTool("delete_collection")).to.equal(true);
      expect(isLegacyDirectMutationTool("search_library")).to.equal(false);
    });
  });

  describe("mutation audit redaction", function () {
    it("does not persist note bodies", function () {
      const redacted = redactMutationArguments("add_note", {
        itemKey: "ABCDEFGH",
        content: "private full note body",
      });
      expect(redacted.content).to.deep.equal({
        redacted: true,
        length: 22,
      });
      expect(JSON.stringify(redacted)).not.to.include("private full note body");
    });

    it("records only changed field names for metadata updates", function () {
      const redacted = redactMutationArguments("update_item", {
        itemKey: "ABCDEFGH",
        fields: { title: "Private title", abstractNote: "Private abstract" },
      });
      expect(redacted.fields).to.deep.equal(["title", "abstractNote"]);
    });

    it("does not persist metadata values for new items", function () {
      const redacted = redactMutationArguments("create_item", {
        itemType: "journalArticle",
        fields: { title: "Private title", abstractNote: "Private abstract" },
      });
      expect(redacted.fields).to.deep.equal(["title", "abstractNote"]);
      expect(JSON.stringify(redacted)).not.to.include("Private title");
    });

    it("does not persist local source directories", function () {
      const redacted = redactMutationArguments("import_attachment_file", {
        sourcePath: "/Users/researcher/private-project/paper.pdf",
      });
      expect(redacted.sourcePath).to.deep.equal({
        redacted: true,
        filename: "paper.pdf",
      });
    });

    it("redacts local source directories from mutation results", function () {
      const redacted = redactMutationDetails({
        decision: "create",
        sourcePath: "/Users/researcher/private-project/paper.pdf",
      });
      expect(redacted.sourcePath).to.deep.equal({
        redacted: true,
        filename: "paper.pdf",
      });
      expect(JSON.stringify(redacted)).not.to.include("private-project");
    });
  });
});
