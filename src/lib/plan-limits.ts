// DEPRECATED — use src/lib/billing.ts (unified). Re-export for back-compat.
export {
  FEATURE_LIMITS as PLAN_LIMITS,
  normalizePlan,
  planLimit,
  isFeatureAllowed,
  isLaneAllowed,
  startOfCurrentMonth,
  requiredPlanFor,
} from "./billing";
export type { BillingPlan, GatedFeature } from "./billing";
