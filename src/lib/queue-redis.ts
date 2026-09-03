// Placeholder for Upstash/BullMQ — not wired in dev to avoid extra dep. Swapped when REDIS_URL set.
// Example prod (uncomment after npm install bullmq ioredis):
// import { Queue } from "bullmq";
// const connection = { host: process.env.REDIS_HOST!, port: Number(process.env.REDIS_PORT ?? 6379), password: process.env.REDIS_PASSWORD };
// export const shipmentQueue = new Queue("shipment", { connection });
// export async function addToRedisQueue(payload: unknown) { await shipmentQueue.add("decision", payload, { attempts: 3, backoff: { type: "exponential", delay: 5000 } }); }

export async function addToRedisQueue(_payload: unknown): Promise<void> {
  throw new Error("Redis queue not configured — install bullmq + ioredis and set REDIS_URL");
}
