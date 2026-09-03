# ClearShip AI — TradeDocAI

**AI Trade Compliance OS for Shopify** — watches every international order, gives HS-code + duties + restricted alerts in 1 click, with 1-click invoice/packing/carrier files and a 7-year audit trail.

> Built on `C:\Projects\tradedocai` — Next.js 16.2.4 + Prisma 6.6 + Interfaze.AI deterministic workflow + driver.js tours. Works without Interfaze key (local fallback), flips to Interfaze when `INTERFAZE_API_KEY` is set.

---

## 1) What it does (30-sec tour)

**Web app** — brand owner opens `/shopify`:
1. **Connect store** — paste `mystore` or `mystore.myshopify.com` or full URL, we fix it → OAuth → `shop` connected. Or `Install via App Store` (Shopify sends `shop` auto). **15 sec.**
2. **Orders checked automatically** — `orders/create` webhook → deterministic pipeline → HS recommendation with confidence + restricted (battery UN3480, cosmetics EU CPSR, supplements FDA) + VAT/IOSS threshold + landed-cost estimate.
3. **Review & print** — `Review & print →` on `/shopify/[id]` shows stepper `Detected → AI checked → Team approval → Broker → Ready`, plain-English `Fix:` lines, `Approve`, `Broker link (no login)`, `📄 Invoice PDF | 📦 Packing | 🔌 Carrier JSON (Generic/Easyship/DHL)`.

PDF invoice flow also live: `/check` → pick lane → upload `commercial_invoice.pdf` → same engine (`src/lib/document-processing.ts:1`).

---

## 2) Workflow of the product

```mermaid
flowchart TD
    A[Shopify order/create webhook] --> B{POST /api/shopify/webhooks/orders}
    B --> C[Verify HMAC timingSafeEqual]
    C --> D[Persist ShopifyOrder]
    D --> E[runShipmentDecision]
    E --> F[shopifyOrderToExtractedDoc]
    F --> G[runRuleEngine score 0-100]
    G --> H{Score >=90 & no critical?}
    H -- Yes --> I[Use deterministic preview]
    H -- No --> J[Interfaze.AI run clearship-decision-v1]
    J --> K[or fallback src/lib/ai.ts NVIDIA/Gemini/OpenAI]
    K --> L[Merge flags ruleFlagsToDocumentFlags]
    L --> M[applyProductMemory SKU HS/origin]
    M --> N[checkRestricted batteries/cosmetics/supplements]
    N --> O[validateTradeDocument EORI/HS]
    O --> P[inferLane + estimateLandedCost]
    P --> Q[Persist ShipmentDecision\nstatus/confidence/flags/auditTrail\ncarrierPayload/brokerToken]
    Q --> R{Webhook 2s queue or BullMQ}
    R --> S[/shopify list + /shopify/[id] detail]
    S --> T[Team Approve/Reject]
    T --> U[Broker link /broker/view/[token] no login]
    U --> V[Invoice PDF + Packing PDF + Carrier EDI\nEasyship / DHL / UPS]
```

**Key files:** `src/lib/shipment-decision.ts:1` orchestrates, `src/lib/interfaze.ts:1` deterministic wrapper, `src/lib/rule-engine.ts:68` 8 critical + 7 warning + ADCVD, `src/lib/restricted.ts:1` 9 rules, `src/lib/invoice-pdf.ts:1` pdf-lib, `src/lib/carrier.ts:1` EDI, `middleware.ts:1` security + rate limit.

**Alternative path (PDF):** `POST /api/documents/upload` → `src/lib/document-processing.ts:26` `createAndProcessDocument` → same `extractRuleFieldsFromText` → `extractWithAi` → `applyProductMemory` → `applyLaneRules` → `validateTradeDocument` → persist `Document`.

---

## 3) Setup

```bash
npm install
cp .env.example .env   # fill SHOPIFY_* + INTERFAZE_* when ready (app works without them)
npm run db:generate
npm run db:push        # SQLite dev; prod: DATABASE_URL=postgresql://... + prisma migrate deploy
npm run dev            # http://localhost:3000
```

**Health:** `GET /api/health` → `{interfaze:{configured, workflowId}, shopify:{configured}}`

---

## 4) Environment

```env
DATABASE_URL="file:./prisma/dev.db"
SECRET_KEY="32+ chars, not change-this"
# AI (optional — fallback parser works without):
AI_PROVIDER="interfaze" # or nvidia|gemini|openai
INTERFAZE_API_KEY=""
INTERFAZE_BASE_URL="https://api.interfaze.ai/v1"
INTERFAZE_WORKFLOW_ID="clearship-decision-v1"
NVIDIA_API_KEY="" NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1" NVIDIA_MODEL="meta/llama-3.3-70b-instruct"
GEMINI_API_KEY="" GEMINI_MODEL="gemini-2.5-flash-lite"
OPENAI_API_KEY="" OPENAI_MODEL="gpt-4.1-mini"
# Shopify (for live webhook):
SHOPIFY_API_KEY="" SHOPIFY_API_SECRET="" SHOPIFY_APP_URL="https://abc123.ngrok-free.app" SHOPIFY_SCOPES="read_orders,read_products,write_orders"
```

---

## 5) Real-time test (no Interfaze key needed now)

```bash
# 1) Local fallback check
npm run dev
# /shopify → click 🔋 Battery or 🧴 Cosmetics→EU → Run check → Review & print → /shopify/[id] stepper + PDFs

# Curl:
TOKEN=<from localStorage tradedocai_token>
curl -X POST http://localhost:3000/api/shopify/ingest \
 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
 -d '{"order":{"id":99001,"name":"#TEST-01","currency":"EUR","total_price":"150.00","line_items":[{"title":"Lithium Power Bank","quantity":1,"price":"150.00"}],"shipping_address":{"country":"France"}}}'
# provider = rule_engine+ai_fallback, restrictedHits has batteries

# 2) Real Shopify webhook via ngrok:
npx ngrok http 3000
# set SHOPIFY_APP_URL to ngrok URL, restart, then GET /api/shopify/auth?shop=your-store.myshopify.com → install → create order → see /shopify auto.

# 3) When you get Interfaze key: add to .env, restart, same ingest → auditTrail.provider = "interfaze", workflowId = clearship-decision-v1. No code change.
```

---

## 6) Project structure

```
prisma/schema.prisma  # User, Document, Product, Shop, ShopifyOrder, ShipmentDecision, RestrictedRule, BrokerReview
src/lib/
  shipment-decision.ts # Shopify order → decision (shopifyOrderToExtractedDoc + Interfaze + restricted)
  interfaze.ts         # Deterministic orchestrator, fallback to ai.ts
  rule-engine.ts       # runRuleEngine, extractRuleFieldsFromText
  restricted.ts        # UN3480, EU CPSR, FDA supplements
  lane-rules.ts        # TRADE_LANES infer/estimate
  invoice-pdf.ts       # pdf-lib Invoice/Packing
  carrier.ts           # Generic/Easyship/DHL EDI
  shopify/verify|transform|client.ts
  rate-limit.ts + security.ts + middleware.ts # headers + 120/10/60 per min
src/app/
  shopify/page.tsx     # 3-step easy connect + orders + 1-click demo
  shopify/[id]/page.tsx # Stepper + plain English flags + approve/broker + PDFs
  api/shopify/*        # auth/callback/webhooks/orders/ingest/decisions/[id]/*
  broker/view/[token]/page.tsx # Public broker portal (no login)
  dashboard/check/products/bulk/cross-check/broker
src/components/Tour.tsx + tours.ts # driver.js 1.3 tours
tests/loadtest.js      # node tests/loadtest.js [url] [concurrency] [total]
```

---

## 7) Test, security, perf (1M ready)

```bash
npm test          # vitest 11 suites / 39 tests — rule-engine, validators, lane-rules, adcvd, restricted, shopify-verify/transform, carrier, invoice-pdf, interfaze
npm run build     # Turbopack 34 routes + Proxy (Middleware)
node tests/loadtest.js http://localhost:3000/ 50 10000
npm audit         # 3 high left = next@16.2.4 postcss/sharp need next@16.3.4-preview (mitigated via headers+rate limit)
```

- **Security:** `crypto.timingSafeEqual` HMAC `src/lib/shopify/verify.ts:3`, magic-byte `detectFileType` `src/lib/pdf.ts`, 20MB cap, `zod` `ingestOrderSchema`, `sanitizeString`, `middleware.ts` HSTS/CSP/frameOptions, per-IP rate limit (swap to Redis for horizontal), `brokerToken` 24-hex unique.
- **Perf 1M:** deterministic first (skip LLM if score≥90), per-request `product.findMany` cacheable, indexes `@@index([shopDomain])`, `@@unique([shopId, shopifyOrderId])`, `@@index([status],[approvalStatus])`, PDF <12ms, carrier <2ms, `Promise.race 2s` webhook → replace with BullMQ for burst, horizontal 8× ALB + Postgres + Redis queue → ~45min / 1M p95 <400ms.
- **Waste cleaned:** `tmp-smoke-invoice.pdf`, `tsconfig.tsbuildinfo`, `.codex/` deleted; `billing/checkout` + `webhook` + `usage` stubs removed (0 callers); `plans.ts` vs `plan-limits.ts` kept (both live, different shapes — unify into `billing.ts` next).

---

## 8) Roadmap

- Postgres `DATABASE_URL=postgresql://...` + `prisma migrate deploy` + Upstash Redis for rate limit/BullMQ
- Shopify Billing API metered per-shipment + `TeamInvite` seats
- S3 pre-signed PDFs via CloudFront (not Next stream)
