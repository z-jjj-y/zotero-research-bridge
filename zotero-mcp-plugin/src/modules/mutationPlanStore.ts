import type { MutationOperation, MutationRisk } from "./mutationOperations";
import type { WriteScope } from "./serverPreferences";

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PLANS = 100;

export interface MutationPlanDraft {
  operation: MutationOperation;
  arguments: Record<string, any>;
  summary: string;
  risk: MutationRisk;
  requiredScopes: WriteScope[];
  preview: Record<string, any>;
}

export interface StoredMutationPlan extends MutationPlanDraft {
  planId: string;
  confirmationToken: string;
  createdAt: string;
  expiresAt: string;
}

export type MutationPlanView = Omit<StoredMutationPlan, "arguments">;

export interface MutationPlanStoreOptions {
  ttlMs?: number;
  maxPlans?: number;
  now?: () => number;
  randomHex?: (bytes: number) => string;
}

function defaultRandomHex(bytes: number): string {
  const data = new Uint8Array(bytes);
  try {
    globalThis.crypto.getRandomValues(data);
  } catch {
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let i = 0; i < maxLength; i++) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export function cloneMutationData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MutationPlanStore {
  private plans = new Map<string, StoredMutationPlan>();
  private readonly ttlMs: number;
  private readonly maxPlans: number;
  private readonly now: () => number;
  private readonly randomHex: (bytes: number) => string;

  constructor(options: MutationPlanStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS;
    this.now = options.now ?? Date.now;
    this.randomHex = options.randomHex ?? defaultRandomHex;
  }

  create(draft: MutationPlanDraft): MutationPlanView {
    this.purgeExpired();
    while (this.plans.size >= this.maxPlans) {
      const oldest = this.plans.keys().next().value;
      if (!oldest) break;
      this.plans.delete(oldest);
    }

    const createdAtMs = this.now();
    const plan: StoredMutationPlan = {
      ...draft,
      arguments: cloneMutationData(draft.arguments),
      preview: cloneMutationData(draft.preview),
      requiredScopes: [...draft.requiredScopes],
      planId: `plan_${this.randomHex(12)}`,
      confirmationToken: `confirm_${this.randomHex(16)}`,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(createdAtMs + this.ttlMs).toISOString(),
    };
    this.plans.set(plan.planId, plan);
    return this.toView(plan);
  }

  consume(planId: string, confirmationToken: string): StoredMutationPlan {
    this.purgeExpired();
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error("Mutation plan not found or expired; create a new plan");
    }
    if (!constantTimeEqual(plan.confirmationToken, confirmationToken)) {
      throw new Error("Invalid mutation confirmation token");
    }
    this.plans.delete(planId);
    return {
      ...plan,
      arguments: cloneMutationData(plan.arguments),
      preview: cloneMutationData(plan.preview),
      requiredScopes: [...plan.requiredScopes],
    };
  }

  discard(planId: string): void {
    this.plans.delete(planId);
  }

  get size(): number {
    this.purgeExpired();
    return this.plans.size;
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [planId, plan] of this.plans) {
      if (Date.parse(plan.expiresAt) <= now) {
        this.plans.delete(planId);
      }
    }
  }

  private toView(plan: StoredMutationPlan): MutationPlanView {
    const { arguments: _arguments, ...view } = plan;
    return cloneMutationData(view);
  }
}
