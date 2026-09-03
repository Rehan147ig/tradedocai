// Simple load harness for 1M-request readiness check
// Usage: node tests/loadtest.js [url] [concurrency] [total]
// Default: http://localhost:3000/api/shopify/decisions (needs Bearer token if testing auth)
// For anon perf: test / (landing) or /api/shopify/ingest with mocked token.

const http = require("http");
const https = require("https");

const url = process.argv[2] || "http://localhost:3000/";
const concurrency = parseInt(process.argv[3] || "50", 10);
const total = parseInt(process.argv[4] || "10000", 10);

function fetchOnce(target) {
  return new Promise((resolve, reject) => {
    const lib = target.startsWith("https") ? https : http;
    const req = lib.get(target, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, time: Date.now(), headers: res.headers, bodyLen: body.length }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function run() {
  console.log(`Loadtest: ${url} concurrency=${concurrency} total=${total}`);
  const start = Date.now();
  let done = 0, ok = 0, fail = 0, tSum = 0;
  const errors = new Map();

  async function worker() {
    while (done < total) {
      const idx = done++;
      if (idx >= total) break;
      const t0 = Date.now();
      try {
        const r = await fetchOnce(url);
        const dt = Date.now() - t0;
        tSum += dt;
        if (r.status && r.status < 400) ok++; else { fail++; errors.set(r.status, (errors.get(r.status) || 0) + 1); }
      } catch (e) { fail++; errors.set(e.message, (errors.get(e.message) || 0) + 1); }
      if (idx % 1000 === 0 && idx > 0) console.log(`  ${idx}/${total} ok=${ok} fail=${fail} avg=${(tSum / (ok + fail || 1)).toFixed(1)}ms`);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const secs = (Date.now() - start) / 1000;
  console.log("\n=== RESULT ===");
  console.log(`Requests: ${total}  Concurrency: ${concurrency}  Time: ${secs.toFixed(1)}s  RPS: ${(total / secs).toFixed(0)}`);
  console.log(`OK: ${ok}  Fail: ${fail}  Avg latency: ${(tSum / total).toFixed(1)}ms  p95 est ~${(tSum / total * 1.8).toFixed(0)}ms`);
  console.log("Errors:", Object.fromEntries(errors));
  console.log(`\n1M @ this RPS would take ${(1_000_000 / (total / secs) / 3600).toFixed(2)} hours single-instance. Scale horizontally (4-8 instances + CDN + Postgres + Redis queue) for <1h.`);
  if (fail > total * 0.05) { console.error("FAIL: >5% error rate"); process.exit(1); }
  console.log("PASS: readiness check ok");
}

run().catch((e) => { console.error(e); process.exit(1); });
