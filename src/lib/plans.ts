export const PLAN_LIMITS = {
  free: {
    docsPerMonth: 20,
    storageBytes: 50 * 1024 * 1024,
    retentionDays: 30,
    priceGbp: 0,
    export: false,
  },
  starter: {
    docsPerMonth: 200,
    storageBytes: 2 * 1024 * 1024 * 1024,
    retentionDays: 180,
    priceGbp: 39,
    export: true,
  },
  pro: {
    docsPerMonth: 1000,
    storageBytes: 10 * 1024 * 1024 * 1024,
    retentionDays: 365,
    priceGbp: 99,
    export: true,
  },
  broker: {
    docsPerMonth: 999999,
    storageBytes: 50 * 1024 * 1024 * 1024,
    retentionDays: 730,
    priceGbp: 299,
    export: true,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function getPlan(plan: string) {
  return PLAN_LIMITS[(plan as Plan) in PLAN_LIMITS ? (plan as Plan) : "free"];
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
