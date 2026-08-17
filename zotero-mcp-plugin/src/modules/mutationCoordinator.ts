import { appendMutationAudit } from "./mutationAuditLog";
import {
  assertKnownMutationArguments,
  isMutationOperation,
  MUTATION_RISKS,
  MUTATION_SCOPES,
  type MutationOperation,
} from "./mutationOperations";
import { cloneMutationData, MutationPlanStore } from "./mutationPlanStore";
import { serverPreferences } from "./serverPreferences";
import {
  handleAddNote,
  handleAddRelatedItem,
  handleAddTags,
  handleAddToCollection,
  handleBatchAddToCollection,
  handleBatchRemoveFromCollection,
  handleBatchTag,
  handleBatchTrash,
  handleCreateCollection,
  handleCreateItem,
  handleImportAttachmentFile,
  handleImportAttachmentURL,
  handleLinkAnalysisFile,
  handleMoveCollection,
  handleMoveItemToCollection,
  handleRemoveFromCollection,
  handleRemoveRelatedItem,
  handleRemoveTags,
  handleRenameCollection,
  handleRenameTag,
  handleRestoreFromTrash,
  handleTrashItem,
  handleUpdateItem,
  handleUpdateNote,
  type MutationResult,
  WriteDisabledError,
} from "./writeHandlers";

declare let Zotero: any;

const ZOTERO_KEY_RE = /^[A-Z0-9]{8}$/;
const BATCH_LIMIT = 100;

type MutationHandler = (args: any) => Promise<MutationResult>;

const MUTATION_HANDLERS: Record<MutationOperation, MutationHandler> = {
  add_note: handleAddNote,
  update_note: handleUpdateNote,
  add_tags: handleAddTags,
  remove_tags: handleRemoveTags,
  add_to_collection: handleAddToCollection,
  remove_from_collection: handleRemoveFromCollection,
  create_collection: handleCreateCollection,
  rename_collection: handleRenameCollection,
  move_collection: handleMoveCollection,
  move_item_to_collection: handleMoveItemToCollection,
  create_item: handleCreateItem,
  update_item: handleUpdateItem,
  add_related_item: handleAddRelatedItem,
  remove_related_item: handleRemoveRelatedItem,
  trash_item: handleTrashItem,
  restore_from_trash: handleRestoreFromTrash,
  batch_tag: handleBatchTag,
  batch_add_to_collection: handleBatchAddToCollection,
  batch_remove_from_collection: handleBatchRemoveFromCollection,
  batch_trash: handleBatchTrash,
  rename_tag: handleRenameTag,
  import_attachment_file: handleImportAttachmentFile,
  import_attachment_url: handleImportAttachmentURL,
  link_analysis_file: handleLinkAnalysisFile,
};

const planStore = new MutationPlanStore();

function requireObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, any>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function requireKey(value: unknown, label: string): string {
  const key = requireString(value, label);
  if (!ZOTERO_KEY_RE.test(key)) {
    throw new Error(`Invalid ${label} format (expected 8-char A-Z/0-9)`);
  }
  return key;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  if (value.length > BATCH_LIMIT) {
    throw new Error(`${label} is limited to ${BATCH_LIMIT} entries`);
  }
  return value.map((entry, index) =>
    requireString(entry, `${label}[${index}]`),
  );
}

function getItemSummary(itemKeyValue: unknown): Record<string, any> {
  const itemKey = requireKey(itemKeyValue, "itemKey");
  const item = Zotero.Items.getByLibraryAndKey(
    Zotero.Libraries.userLibraryID,
    itemKey,
  );
  if (!item) throw new Error(`Item with key "${itemKey}" not found`);
  return {
    itemKey,
    title: item.getField?.("title") || itemKey,
    itemType: item.itemType || null,
    deleted: Boolean(item.deleted),
    dateModified: item.dateModified || null,
  };
}

function getCollectionSummary(
  collectionKeyValue: unknown,
): Record<string, any> {
  const collectionKey = requireKey(collectionKeyValue, "collectionKey");
  const collection = Zotero.Collections.getByLibraryAndKey(
    Zotero.Libraries.userLibraryID,
    collectionKey,
  );
  if (!collection) {
    throw new Error(`Collection with key "${collectionKey}" not found`);
  }
  return {
    collectionKey,
    name: collection.name,
    parentCollectionKey: collection.parentKey || null,
  };
}

function getRequiredScopes(
  operation: MutationOperation,
  args?: Record<string, any>,
) {
  const scopes = [...MUTATION_SCOPES[operation]];
  if (
    (operation === "import_attachment_file" ||
      operation === "import_attachment_url") &&
    args?.ifExists === "replace"
  ) {
    scopes.push("delete");
  }
  return scopes;
}

function assertScopes(
  operation: MutationOperation,
  args?: Record<string, any>,
): void {
  for (const scope of getRequiredScopes(operation, args)) {
    if (!serverPreferences.isScopeEnabled(scope)) {
      throw new WriteDisabledError(scope);
    }
  }
}

async function buildPreview(
  operation: MutationOperation,
  args: Record<string, any>,
): Promise<{ summary: string; preview: Record<string, any> }> {
  switch (operation) {
    case "add_note": {
      const content = requireString(args.content, "content");
      const parent = args.itemKey ? getItemSummary(args.itemKey) : null;
      return {
        summary: parent
          ? `Create a child note under ${parent.title}`
          : "Create a standalone note",
        preview: {
          parent,
          contentLength: content.length,
          contentPreview: content.slice(0, 200),
          tags: args.tags || [],
        },
      };
    }
    case "update_note": {
      const note = getItemSummary(args.noteKey);
      const item = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        note.itemKey,
      );
      if (!item?.isNote?.()) throw new Error(`${note.itemKey} is not a note`);
      const content = requireString(args.content, "content");
      return {
        summary: `Replace note content for ${note.itemKey}`,
        preview: {
          note,
          oldContentLength: String(item.getNote?.() || "").length,
          newContentLength: content.length,
          contentPreview: content.slice(0, 200),
          replaceTags: args.tags !== undefined,
          tags: args.tags || [],
        },
      };
    }
    case "add_tags":
    case "remove_tags": {
      const item = getItemSummary(args.itemKey);
      const tags = requireStringArray(args.tags, "tags");
      return {
        summary: `${operation === "add_tags" ? "Add" : "Remove"} ${tags.length} tag(s) ${operation === "add_tags" ? "to" : "from"} ${item.title}`,
        preview: { item, tags },
      };
    }
    case "add_to_collection":
    case "remove_from_collection": {
      const item = getItemSummary(args.itemKey);
      const collection = getCollectionSummary(args.collectionKey);
      return {
        summary: `${operation === "add_to_collection" ? "Add" : "Remove"} ${item.title} ${operation === "add_to_collection" ? "to" : "from"} collection ${collection.name}`,
        preview: { item, collection },
      };
    }
    case "create_collection": {
      const name = requireString(args.name, "name");
      const parent = args.parentCollectionKey
        ? getCollectionSummary(args.parentCollectionKey)
        : null;
      return {
        summary: `Create collection ${name}`,
        preview: { name, parent },
      };
    }
    case "rename_collection": {
      const collection = getCollectionSummary(args.collectionKey);
      const newName = requireString(args.newName, "newName");
      return {
        summary: `Rename collection ${collection.name} to ${newName}`,
        preview: { collection, newName },
      };
    }
    case "move_collection": {
      const collection = getCollectionSummary(args.collectionKey);
      const destination = args.newParentKey
        ? getCollectionSummary(args.newParentKey)
        : null;
      return {
        summary: `Move collection ${collection.name} ${destination ? `under ${destination.name}` : "to the library root"}`,
        preview: { collection, destination },
      };
    }
    case "move_item_to_collection": {
      const item = getItemSummary(args.itemKey);
      const from = getCollectionSummary(args.fromCollectionKey);
      const to = getCollectionSummary(args.toCollectionKey);
      return {
        summary: `Move ${item.title} from ${from.name} to ${to.name}`,
        preview: { item, from, to },
      };
    }
    case "create_item": {
      const itemType = requireString(args.itemType, "itemType");
      const fields = args.fields ? requireObject(args.fields, "fields") : {};
      return {
        summary: `Create Zotero ${itemType} item`,
        preview: {
          itemType,
          fieldNames: Object.keys(fields),
          title: fields.title || null,
          creatorCount: Array.isArray(args.creators) ? args.creators.length : 0,
          tags: args.tags || [],
          collections: args.collections || [],
        },
      };
    }
    case "update_item": {
      const item = getItemSummary(args.itemKey);
      const fields = args.fields ? requireObject(args.fields, "fields") : {};
      if (Object.keys(fields).length === 0 && !args.creators) {
        throw new Error("At least one of fields or creators is required");
      }
      const zoteroItem = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        item.itemKey,
      );
      const fieldChanges = Object.fromEntries(
        Object.entries(fields).map(([field, value]) => [
          field,
          { before: zoteroItem.getField?.(field) ?? null, after: value },
        ]),
      );
      return {
        summary: `Update ${item.title}`,
        preview: {
          item,
          fieldChanges,
          replaceCreators: args.creators !== undefined,
          newCreatorCount: Array.isArray(args.creators)
            ? args.creators.length
            : null,
        },
      };
    }
    case "add_related_item":
    case "remove_related_item": {
      const item = getItemSummary(args.itemKey);
      const related = getItemSummary(args.relatedItemKey);
      return {
        summary: `${operation === "add_related_item" ? "Add" : "Remove"} related-item link between ${item.title} and ${related.title}`,
        preview: { item, related },
      };
    }
    case "trash_item":
    case "restore_from_trash": {
      const item = getItemSummary(args.itemKey);
      return {
        summary: `${operation === "trash_item" ? "Move" : "Restore"} ${item.title} ${operation === "trash_item" ? "to trash" : "from trash"}`,
        preview: { item },
      };
    }
    case "batch_tag": {
      const itemKeys = requireStringArray(args.itemKeys, "itemKeys");
      const tags = requireStringArray(args.tags, "tags");
      const items = itemKeys.map(getItemSummary);
      return {
        summary: `Add ${tags.length} tag(s) to ${items.length} item(s)`,
        preview: { items, tags },
      };
    }
    case "batch_add_to_collection":
    case "batch_remove_from_collection": {
      const itemKeys = requireStringArray(args.itemKeys, "itemKeys");
      const items = itemKeys.map(getItemSummary);
      const collection = getCollectionSummary(args.collectionKey);
      return {
        summary: `${operation === "batch_add_to_collection" ? "Add" : "Remove"} ${items.length} item(s) ${operation === "batch_add_to_collection" ? "to" : "from"} ${collection.name}`,
        preview: { items, collection },
      };
    }
    case "batch_trash": {
      const itemKeys = requireStringArray(args.itemKeys, "itemKeys");
      const items = itemKeys.map(getItemSummary);
      return {
        summary: `Move ${items.length} item(s) to trash`,
        preview: { items },
      };
    }
    case "rename_tag": {
      const oldName = requireString(args.oldName, "oldName");
      const newName = requireString(args.newName, "newName");
      return {
        summary: `Rename tag ${oldName} to ${newName} across the library`,
        preview: { oldName, newName, scope: "entire library" },
      };
    }
    case "import_attachment_file": {
      const sourcePath = requireString(args.sourcePath, "sourcePath");
      const dryRun = await handleImportAttachmentFile({
        ...args,
        sourcePath,
        dryRun: true,
      } as any);
      return {
        summary: `Import local PDF ${sourcePath.split(/[\\/]/).pop() || sourcePath}`,
        preview: dryRun.details,
      };
    }
    case "import_attachment_url": {
      const url = requireString(args.url, "url");
      const dryRun = await handleImportAttachmentURL({
        ...args,
        url,
        dryRun: true,
      } as any);
      return {
        summary: `Import attachment from ${url}`,
        preview: dryRun.details,
      };
    }
    case "link_analysis_file": {
      const sourcePath = requireString(args.sourcePath, "sourcePath");
      const parentItemKey = requireKey(args.parentItemKey, "parentItemKey");
      const dryRun = await handleLinkAnalysisFile({
        ...args,
        sourcePath,
        parentItemKey,
        dryRun: true,
      });
      return {
        summary: `Link external analysis ${sourcePath.split(/[\\/]/).pop() || sourcePath} to ${dryRun.details.parentTitle}`,
        preview: dryRun.details,
      };
    }
  }
}

export async function planMutation(args: {
  operation?: unknown;
  arguments?: unknown;
}): Promise<Record<string, any>> {
  if (!isMutationOperation(args?.operation)) {
    throw new Error("Unsupported or unsafe mutation operation");
  }
  const operation = args.operation;
  const exactArguments = cloneMutationData(
    requireObject(args.arguments, "arguments"),
  );
  assertKnownMutationArguments(operation, exactArguments);
  assertScopes(operation, exactArguments);
  if (
    operation === "import_attachment_file" ||
    operation === "import_attachment_url" ||
    operation === "link_analysis_file"
  ) {
    delete exactArguments.dryRun;
  }
  const { summary, preview } = await buildPreview(operation, exactArguments);
  const plan = planStore.create({
    operation,
    arguments: exactArguments,
    summary,
    risk: MUTATION_RISKS[operation],
    requiredScopes: getRequiredScopes(operation, exactArguments),
    preview,
  });

  try {
    const auditPath = await appendMutationAudit({
      planId: plan.planId,
      operation,
      status: "planned",
      arguments: exactArguments,
      details: { summary, risk: plan.risk, expiresAt: plan.expiresAt },
    });
    return {
      ...plan,
      auditPath,
      nextStep:
        "Review summary and preview, then call apply_mutation with planId and confirmationToken.",
    };
  } catch (error) {
    planStore.discard(plan.planId);
    throw new Error(`Could not write mutation audit log: ${error}`);
  }
}

export async function applyMutation(args: {
  planId?: unknown;
  confirmationToken?: unknown;
}): Promise<Record<string, any>> {
  const planId = requireString(args?.planId, "planId");
  const confirmationToken = requireString(
    args?.confirmationToken,
    "confirmationToken",
  );
  const plan = planStore.consume(planId, confirmationToken);
  assertScopes(plan.operation, plan.arguments);

  const auditPath = await appendMutationAudit({
    planId,
    operation: plan.operation,
    status: "apply_started",
    arguments: plan.arguments,
    details: { summary: plan.summary, risk: plan.risk },
  });

  try {
    const result = await MUTATION_HANDLERS[plan.operation](plan.arguments);
    let auditWarning: string | undefined;
    try {
      await appendMutationAudit({
        planId,
        operation: plan.operation,
        status: "apply_succeeded",
        details: result.details,
      });
    } catch (error) {
      auditWarning = `Mutation succeeded, but completion audit failed: ${error}`;
    }
    return {
      ...result,
      planId,
      auditPath,
      auditWarning,
    };
  } catch (error) {
    try {
      await appendMutationAudit({
        planId,
        operation: plan.operation,
        status: "apply_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // The apply_started record already exists; preserve the original error.
    }
    throw error;
  }
}
