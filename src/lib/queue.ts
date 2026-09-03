// Background queue — in-memory now, BullMQ/Redis when deployed.
// Swaps by setting REDIS_URL / UPSTASH_REDIS_REST_URL — same enqueue() interface.

type Job = { id: string; type: "shipment_decision"; payload: unknown; attempts: number };

const queue: Job[] = [];
let processing = false;
let useRedis = false;

// Lazy detect Redis env — don't import ioredis in dev to avoid missing dep
if (process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) useRedis = true;

export async function enqueueShipmentDecision(payload: unknown): Promise<{ queued: boolean; mode: "redis" | "memory" | "inline" }> {
  if (useRedis) {
    // In prod, replace with BullMQ: await shipmentQueue.add('decision', payload, { attempts: 3, backoff: 5000 })
    // Fallback to memory if Redis package not installed
    try {
      const { addToRedisQueue } = await import("./queue-redis").catch(() => ({ addToRedisQueue: null }));
      if (addToRedisQueue) { await addToRedisQueue(payload); return { queued: true, mode: "redis" }; }
    } catch {}
  }
  // In-memory queue with async worker
  queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "shipment_decision", payload, attempts: 0 });
  void drain();
  return { queued: true, mode: "memory" };
}

async function drain() {
  if (processing) return;
  processing = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const { runShipmentDecision } = await import("./shipment-decision");
      const p = job.payload as { userId: string; shopId?: string; shopDomain?: string; shopifyOrderId?: string; shopifyOrderNumber?: string | null; shopifyOrder: unknown };
      await runShipmentDecision(p as never);
    } catch (e) {
      job.attempts += 1;
      if (job.attempts < 3) queue.push(job); // retry
      else console.error("[queue] job failed after 3 attempts", job.id, e);
    }
  }
  processing = false;
}

export function queueMetrics() {
  return { pending: queue.length, processing, mode: useRedis ? "redis" : "memory" };
}
