import type { MutationOperation } from "./mutationOperations";

declare let Zotero: any;

export type MutationAuditStatus =
  | "planned"
  | "apply_started"
  | "apply_succeeded"
  | "apply_failed";

export interface MutationAuditEvent {
  planId: string;
  operation: MutationOperation;
  status: MutationAuditStatus;
  arguments?: Record<string, any>;
  details?: Record<string, any>;
  error?: string;
}

const SENSITIVE_METADATA_KEYS = new Set([
  "summary",
  "title",
  "parentTitle",
  "name",
  "oldName",
  "newName",
  "collectionName",
  "fromCollectionName",
  "toCollectionName",
  "tagName",
  "tags",
  "added",
  "skipped",
  "removed",
  "notFound",
  "creators",
  "firstName",
  "lastName",
  "url",
  "originalUrl",
  "error",
]);

function redactSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return { redacted: true, length: value.length };
  }
  if (Array.isArray(value)) {
    return { redacted: true, count: value.length };
  }
  if (typeof value === "object") {
    return { redacted: true, fields: Object.keys(value) };
  }
  return value;
}

function sanitizeValue(value: unknown, depth = 0, key = ""): unknown {
  if (depth > 4) return "[max-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (key === "content") {
      return { redacted: true, length: value.length };
    }
    if (key === "sourcePath") {
      return {
        redacted: true,
        filename: value.split(/[\\/]/).pop() || "",
      };
    }
    if (SENSITIVE_METADATA_KEYS.has(key)) {
      return redactSensitiveValue(value);
    }
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (SENSITIVE_METADATA_KEYS.has(key)) {
    return redactSensitiveValue(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [entryKey, entry] of Object.entries(value)) {
      output[entryKey] = sanitizeValue(entry, depth + 1, entryKey);
    }
    return output;
  }
  return String(value);
}

export function redactMutationArguments(
  operation: MutationOperation,
  args: Record<string, any>,
): Record<string, any> {
  const redacted = sanitizeValue(args) as Record<string, any>;
  if (typeof args.content === "string") {
    redacted.content = {
      redacted: true,
      length: args.content.length,
    };
  }
  if (
    (operation === "create_item" || operation === "update_item") &&
    args.fields
  ) {
    redacted.fields = Object.keys(args.fields);
  }
  if (
    (operation === "import_attachment_file" ||
      operation === "link_analysis_file") &&
    args.sourcePath
  ) {
    redacted.sourcePath = {
      redacted: true,
      filename: String(args.sourcePath).split(/[\\/]/).pop() || "",
    };
  }
  return redacted;
}

export function redactMutationDetails(
  details: Record<string, any>,
): Record<string, any> {
  return sanitizeValue(details) as Record<string, any>;
}

export function getMutationAuditPath(): string {
  return PathUtils.join(
    Zotero.DataDirectory.dir,
    "zotero-research-bridge",
    "mutation-audit.jsonl",
  );
}

export async function appendMutationAudit(
  event: MutationAuditEvent,
): Promise<string> {
  const path = getMutationAuditPath();
  const directory = PathUtils.parent(path);
  if (!directory) throw new Error("Could not resolve audit-log directory");
  await IOUtils.makeDirectory(directory, {
    createAncestors: true,
    ignoreExisting: true,
    permissions: 0o700,
  });

  const record = {
    timestamp: new Date().toISOString(),
    ...event,
    arguments: event.arguments
      ? redactMutationArguments(event.operation, event.arguments)
      : undefined,
    details: event.details ? redactMutationDetails(event.details) : undefined,
    error: event.error
      ? (sanitizeValue(event.error, 0, "error") as Record<string, any>)
      : undefined,
  };
  await IOUtils.writeUTF8(path, `${JSON.stringify(record)}\n`, {
    mode: "appendOrCreate",
    flush: true,
  });
  return path;
}
