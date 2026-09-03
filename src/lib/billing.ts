// Unified billing — single source of truth for TradeDocAI / ClearShip AI
// Keeps storage metering (plans.ts) + feature gating (plan-limits.ts) in one module.
// Shopify App Billing can map directly to these tiers via SHOPIFY_BILLING_* env.

export const STORAGE_LIMITS = {
  free: { docsPerMonth: 20, storageBytes: 50 * 1024 * 1024, retentionDays: 30, priceGbp: 0, priceUsd: 0, export: false },
  starter: { docsPerMonth: 200, storageBytes: 2 * 1024 * 1024 * 1024, retentionDays: 180, priceGbp: 39, priceUsd: 49, export: true },
  pro: { docsPerMonth: 1000, storageBytes: 10 * 1024 * 1024 * 1024, retentionDays: 365, priceGbp: 99, priceUsd: 129, export: true },
  broker: { docsPerMonth: 999999, storageBytes: 50 * 1024 * 1024 * 1024, retentionDays: 730, priceGbp: 299, priceUsd: 399, export: true },
  business: { docsPerMonth: 999999, storageBytes: 50 * 1024 * 1024 * 1024, retentionDays: 730, priceGbp: 299, priceUsd: 399, export: true },
} as const;

export const FEATURE_LIMITS = {
  free: { checks_per_month: 3, sku_memory_limit: 5, lanes: ["india-us"] as const, bulk_upload: false, broker_handoff: false, cross_check: false, api_access: false, team_seats: 1 },
  starter: { checks_per_month: 15, sku_memory_limit: 20, lanes: ["india-us", "india-uk", "india-eu", "uk-eu"] as const, bulk_upload: false, broker_handoff: false, cross_check: false, api_access: false, team_seats: 1 },
  pro: { checks_per_month: -1, sku_memory_limit: -1, lanes: "all" as const, bulk_upload: true, broker_handoff: true, cross_check: true, api_access: false, team_seats: 1 },
  broker: { checks_per_month: -1, sku_memory_limit: -1, lanes: "all" as const, bulk_upload: true, broker_handoff: true, cross_check: true, api_access: true, team_seats: 5 },
  business: { checks_per_month: -1, sku_memory_limit: -1, lanes: "all" as const, bulk_upload: true, broker_handoff: true, cross_check: true, api_access: true, team_seats: 5 },
} as const;

// Back-compat aliases — keep old imports working without breakage
export const PLAN_LIMITS = STORAGE_LIMITS;
export type Plan = keyof typeof STORAGE_LIMITS;
export type BillingPlan = keyof typeof FEATURE_LIMITS;
export type GatedFeature = "bulk_upload" | "broker_handoff" | "cross_check" | "api_access";

export function normalizePlan(plan: string): BillingPlan {
  if (plan === "broker") return "business";
  if (plan === "business") return "business";
  return plan in FEATURE_LIMITS ? (plan as BillingPlan) : "free";
}

export function getPlan(plan: string) {
  const key = (plan as Plan) in STORAGE_LIMITS ? (plan as Plan) : plan === "business" ? "broker" : "free";
  return STORAGE_LIMITS[key];
}

export function planLimit(plan: string) {
  return FEATURE_LIMITS[normalizePlan(plan)];
}

export function isFeatureAllowed(plan: string, feature: GatedFeature) {
  return Boolean(planLimit(plan)[feature]);
}

export function isLaneAllowed(plan: string, lane: string) {
  const lanes = planLimit(plan).lanes;
  return lanes === "all" || (lanes as readonly string[]).includes(lane);
}

export function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function requiredPlanFor(feature: GatedFeature) {
  return feature === "api_access" ? "business" : "pro";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// Shopify App Billing helper — returns price ID env var for current plan
export function shopifyPriceIdForPlan(plan: string): string | null {
  const p = normalizePlan(plan);
  if (p === "starter") return process.env.SHOPIFY_STARTER_PRICE_ID ?? process.env.PADDLE_STARTER_PRICE_ID ?? null;
  if (p === "pro") return process.env.SHOPIFY_PRO_PRICE_ID ?? process.env.PADDLE_PRO_PRICE_ID ?? null;
  if (p === "business" || p === "broker") return process.env.SHOPIFY_BROKER_PRICE_ID ?? process.env.PADDLE_BROKER_PRICE_ID ?? null;
  return null;
}
