export const PLAN_LIMITS = {
  free: {
    checks_per_month: 3,
    sku_memory_limit: 5,
    lanes: ["india-us"],
    bulk_upload: false,
    broker_handoff: false,
    cross_check: false,
    api_access: false,
    team_seats: 1,
  },
  starter: {
    checks_per_month: 15,
    sku_memory_limit: 20,
    lanes: ["india-us", "india-uk", "india-eu", "uk-eu"],
    bulk_upload: false,
    broker_handoff: false,
    cross_check: false,
    api_access: false,
    team_seats: 1,
  },
  pro: {
    checks_per_month: -1,
    sku_memory_limit: -1,
    lanes: "all",
    bulk_upload: true,
    broker_handoff: true,
    cross_check: true,
    api_access: false,
    team_seats: 1,
  },
  business: {
    checks_per_month: -1,
    sku_memory_limit: -1,
    lanes: "all",
    bulk_upload: true,
    broker_handoff: true,
    cross_check: true,
    api_access: true,
    team_seats: 5,
  },
} as const;

export type BillingPlan = keyof typeof PLAN_LIMITS;
export type GatedFeature = "bulk_upload" | "broker_handoff" | "cross_check" | "api_access";

export function normalizePlan(plan: string): BillingPlan {
  if (plan === "broker") return "business";
  return plan in PLAN_LIMITS ? (plan as BillingPlan) : "free";
}

export function planLimit(plan: string) {
  return PLAN_LIMITS[normalizePlan(plan)];
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
