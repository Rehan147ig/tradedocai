// Token bucket — in-memory dev, Upstash Redis prod (same interface). Auto-swaps when UPSTASH_REDIS_REST_URL set.
const buckets = new Map<string, { tokens: number; last: number }>();
let redisWarned = false;

async function redisRateLimit(key: string, windowMs: number, max: number): Promise<{ allowed: boolean; remaining: number; resetMs: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const rKey = `ratelimit:${key}`;
    const res = await fetch(`${url}/eval/INCR_EXPIRE/${rKey}/${max}/${Math.ceil(windowMs / 1000)}`, {
      // Fallback to simple INCR + EXPIRE if eval not configured
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json().catch(() => null) as { result?: number } | null;
      const count = Number(data?.result ?? 0);
      const remaining = Math.max(0, max - count);
      return { allowed: count <= max, remaining, resetMs: windowMs };
    }
    // Simple Upstash REST: INCR + TTL path
    const incr = await fetch(`${url}/incr/${rKey}`, { headers: { Authorization: `Bearer ${token}` } });
    if (incr.ok) {
      const data = await incr.json().catch(() => null) as { result?: number } | null;
      const count = Number(data?.result ?? 1);
      if (count === 1) await fetch(`${url}/expire/${rKey}/${Math.ceil(windowMs / 1000)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      return { allowed: count <= max, remaining: Math.max(0, max - count), resetMs: windowMs };
    }
  } catch (e) {
    if (!redisWarned) { console.warn("[rate-limit] Redis failed, falling back to memory", e); redisWarned = true; }
  }
  return null;
}

export interface RateLimitOpts {
  windowMs: number;
  max: number;
  key: string;
}

export function rateLimit({ windowMs, max, key }: RateLimitOpts): { allowed: boolean; remaining: number; resetMs: number } {
  // Sync in-memory path (fast). For Redis, call async redisRateLimit() — middleware will handle.
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.last > windowMs) {
    buckets.set(key, { tokens: max - 1, last: now });
    return { allowed: true, remaining: max - 1, resetMs: windowMs };
  }
  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetMs: windowMs - (now - bucket.last) };
  }
  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetMs: windowMs - (now - bucket.last) };
}

export async function rateLimitAsync(opts: RateLimitOpts): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const redis = await redisRateLimit(opts.key, opts.windowMs, opts.max);
  if (redis) return redis;
  return rateLimit(opts);
}

export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

// Cleanup every 5 min
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now - v.last > 10 * 60 * 1000) buckets.delete(k);
  }, 5 * 60 * 1000).unref?.();
}
