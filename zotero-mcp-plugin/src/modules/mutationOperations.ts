import type { WriteScope } from "./serverPreferences";

export const MUTATION_OPERATIONS = [
  "add_note",
  "update_note",
  "add_tags",
  "remove_tags",
  "add_to_collection",
  "remove_from_collection",
  "create_collection",
  "rename_collection",
  "move_collection",
  "move_item_to_collection",
  "create_item",
  "update_item",
  "add_related_item",
  "remove_related_item",
  "trash_item",
  "restore_from_trash",
  "batch_tag",
  "batch_add_to_collection",
  "batch_remove_from_collection",
  "batch_trash",
  "rename_tag",
  "import_attachment_file",
  "import_attachment_url",
  "link_analysis_file",
] as const;

export type MutationOperation = (typeof MUTATION_OPERATIONS)[number];

export type MutationRisk = "low" | "medium" | "high";

export const MUTATION_SCOPES: Record<MutationOperation, WriteScope[]> = {
  add_note: ["notes"],
  update_note: ["notes"],
  add_tags: ["tags"],
  remove_tags: ["tags"],
  add_to_collection: ["collections"],
  remove_from_collection: ["collections"],
  create_collection: ["collections"],
  rename_collection: ["collections"],
  move_collection: ["collections"],
  move_item_to_collection: ["collections"],
  create_item: ["metadata"],
  update_item: ["metadata"],
  add_related_item: ["metadata"],
  remove_related_item: ["metadata"],
  trash_item: ["delete"],
  restore_from_trash: ["delete"],
  batch_tag: ["bulk", "tags"],
  batch_add_to_collection: ["bulk", "collections"],
  batch_remove_from_collection: ["bulk", "collections"],
  batch_trash: ["bulk", "delete"],
  rename_tag: ["tags", "bulk"],
  import_attachment_file: ["import"],
  import_attachment_url: ["import"],
  link_analysis_file: ["import"],
};

export const MUTATION_RISKS: Record<MutationOperation, MutationRisk> = {
  add_note: "low",
  update_note: "medium",
  add_tags: "low",
  remove_tags: "medium",
  add_to_collection: "low",
  remove_from_collection: "medium",
  create_collection: "low",
  rename_collection: "medium",
  move_collection: "medium",
  move_item_to_collection: "medium",
  create_item: "low",
  update_item: "medium",
  add_related_item: "low",
  remove_related_item: "medium",
  trash_item: "high",
  restore_from_trash: "medium",
  batch_tag: "medium",
  batch_add_to_collection: "medium",
  batch_remove_from_collection: "high",
  batch_trash: "high",
  rename_tag: "high",
  import_attachment_file: "medium",
  import_attachment_url: "medium",
  link_analysis_file: "low",
};

const MUTATION_OPERATION_SET = new Set<string>(MUTATION_OPERATIONS);

const STRICT_ARGUMENT_KEYS: Partial<
  Record<MutationOperation, readonly string[]>
> = {
  move_collection: ["collectionKey", "newParentKey"],
  link_analysis_file: ["sourcePath", "parentItemKey", "title"],
};

const LEGACY_DIRECT_MUTATION_TOOLS = new Set<string>([
  ...MUTATION_OPERATIONS,
  "delete_collection",
  "delete_tag",
]);

export function isMutationOperation(
  value: unknown,
): value is MutationOperation {
  return typeof value === "string" && MUTATION_OPERATION_SET.has(value);
}

export function assertKnownMutationArguments(
  operation: MutationOperation,
  args: Record<string, any>,
): void {
  const allowedKeys = STRICT_ARGUMENT_KEYS[operation];
  if (!allowedKeys) return;
  const unknownKeys = Object.keys(args).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length === 0) return;
  throw new Error(
    `Unexpected argument(s) for ${operation}: ${unknownKeys.join(", ")}. Allowed arguments: ${allowedKeys.join(", ")}`,
  );
}

export function isLegacyDirectMutationTool(value: unknown): boolean {
  return typeof value === "string" && LEGACY_DIRECT_MUTATION_TOOLS.has(value);
}
