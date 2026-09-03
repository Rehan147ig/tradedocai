# ClearShip AI — Workflow (easy, 1-click)

This doc is the full user + system workflow. New source of truth — old PERFORMANCE.md/SECURITY.md merged into README.

---

## User workflow (web app) — 3 steps, plain English

### Step 1 — Connect Shopify (15 sec, one field)
**Page:** `/shopify` → card “Connect store” (`src/components/ShopifyConnect.tsx:1`)
- User pastes **anything**: `mystore` or `mystore.myshopify.com` or `https://mystore.myshopify.com/admin`
- We run `parseShopInput()` → `sanitizeShopDomain()` (`src/lib/shopify/verify.ts:28`) — extracts hostname, auto-adds `.myshopify.com` for bare name, rejects `evil.com` and `@email` with helpful error
- `GET /api/shopify/auth?shop=mystore.myshopify.com` → redirect to `https://mystore.myshopify.com/admin/oauth/authorize` → **Shopify asks user to approve** → `GET /api/shopify/callback` verifies `hmac` (`verifyShopifyOAuthHmac`) → exchanges `code` for `accessToken` → upsert `Shop` (`prisma/schema.prisma:146`) → `registerWebhooks()` for `orders/create` + `app/uninstalled` → redirect `/shopify?shop=...&connected=1` shows `✅ mystore.myshopify.com — live`
- Alternative **1-click:** `Install via App Store` button → Shopify sends `shop` param auto, same callback, no typing

If user already connected, card shows `✅ live — Connect another`.

### Step 2 — Orders checked automatically (no PDF needed)
- Shopify `orders/create` fires → `POST /api/shopify/webhooks/orders` (`src/app/api/shopify/webhooks/orders/route.ts:1`)
  - Verifies `X-Shopify-Hmac-Sha256` via `verifyShopifyHmac` (`timingSafeEqual`) on **raw body** before JSON
  - Looks up `Shop` by `X-Shopify-Shop-Domain`, upserts `ShopifyOrder` (`shopifyOrderId` unique)
  - Calls `runShipmentDecision({userId, shopId, shopDomain, shopifyOrder})` and races 2s (prod → BullMQ queue)
- Demo without store: `/shopify` → `🔋 Battery` / `🧴 Cosmetics→EU` → `Run check →` hits `POST /api/shopify/ingest` (`src/app/api/shopify/ingest/route.ts:1`) — same pipeline, no webhook

### Step 3 — Review, approve, print (1 click)
**Page:** `/shopify/[id]` (`src/app/shopify/[id]/page.tsx:1`)
- **Stepper** (`src/components/Stepper.tsx:1`): `Detected ✓ → AI checked ✓ → Team approval (blue active) → Broker → Ready`. Tied to `status`, `approvalStatus`, `brokerStatus` (`prisma/schema.prisma:194`).
- **Plain English:** `What needs your attention` — every `Flag` shows `Fix: ...` not codes; restricted cards `UN3481` red
- **Team:** `Approve — it’s good` / `Ask for fix` → `POST /api/shopify/decisions/[id]/approve` (`src/app/api/shopify/decisions/[id]/approve/route.ts:1`) sets `approvalStatus=approved|rejected`, `approvedBy=email`
- **Broker:** `broker@email.com → Create broker link →` → `POST /api/shopify/decisions/[id]/broker` generates `brokerToken` 24-hex + link `${APP_URL}/broker/view/${token}`. Broker opens **public** `src/app/broker/view/[token]/page.tsx:1` (no login) → sees order + flags + HS + audit + `Broker Approve/Reject` (server action updates `brokerStatus`).
- **Print:** `📄 Invoice PDF | 📦 Packing | 🔌 Carrier JSON (Generic/Easyship/DHL)` → `GET /api/shopify/decisions/[id]/pdf?type=commercial_invoice` (`src/lib/invoice-pdf.ts:1` pdf-lib) + `GET .../carrier?format=easyship&download=1` (`src/lib/carrier.ts:1`).

List page `/shopify` (`src/app/shopify/page.tsx:1`) shows metrics `Ready / Needs check / Fix`, table `Order | Goes to | What’s up (color badge) | Docs (Review & print →) | Approve`, inline `Approve/Ask fix`.

**Guided tours:** `driver.js` (`src/components/Tour.tsx:1` + `src/lib/tours.ts:1`) — `Shopify` 5 steps auto on first visit, `Decision` 5 steps, `Dashboard` 2, `Check` 2. `Take 60-sec tour` buttons.

---

## System workflow (code path, deterministic first)

```
Shopify order JSON
  → shopifyOrderToExtractedDoc()                 // src/lib/shopify/transform.ts:1
  → extractRuleFieldsFromText + runRuleEngine()  // src/lib/rule-engine.ts:68 (8 critical, 7 warning, checks vague HS/origin/value/currency/incoterms)
  → score >=90 & no critical?
      Yes → use deterministic preview
      No  → runInterfazeDecision()               // src/lib/interfaze.ts:1 → Interfaze workflow clearship-decision-v1 (temp 0.1, JSON schema) or fallback src/lib/ai.ts (NVIDIA/Gemini/OpenAI)
  → merge ruleFlagsToDocumentFlags
  → applyProductMemory()                          // src/lib/product-memory.ts:1 (SKU HS/origin, check vague)
  → checkRestricted() + restrictedHitsToFlags()  // src/lib/restricted.ts:1 (batteries UN3480, cosmetics EU CPSR, supplements FDA)
  → validateTradeDocument()                       // src/lib/validators.ts:51 (EORI regex, HS 6-10 digits, buyer VAT)
  → inferLane() + applyLaneRules() + estimateLandedCost() // src/lib/lane-rules.ts:1 (india-uk 0.08/0.20 etc)
  → buildCarrierPayload()                         // src/lib/shopify/transform.ts:1
  → buildCarrierEdi() for download               // src/lib/carrier.ts:1
  → persist ShipmentDecision { status, confidence, hsRecommendations, flags, auditTrail, carrierPayload, brokerToken, approvalStatus } // prisma/schema.prisma:194
```

**PDF path:** `POST /api/documents/upload` → `createAndProcessDocument()` (`src/lib/document-processing.ts:26`) → `detectFileType` magic bytes, 20MB cap, `checksumMd5`, `mkdir/uploads/{userId}`, `extractTextFromUpload` (pdf-parse), same rule-engine → AI → memory → lane → validate → `prisma.document` + `UserStorage` increment.

**Security + perf in path:** `middleware.ts:1` adds `HSTS/CSP/frameOptions` + per-IP token bucket `src/lib/rate-limit.ts:1` (120/min API, 10/min auth, 60/min webhook). Prisma indexes `Shop(shopDomain)`, `ShopifyOrder(shopId, shopifyOrderId)`, `ShipmentDecision(userId, createdAt)` etc. Poll `/api/health` for `interfaze.configured`.

---

## States

- **Shops:** `Shop.isActive`, `uninstalledAt` via `app/uninstalled` webhook
- **Decisions:** `status=needs_review|critical|ready|processing`, `approvalStatus=pending|approved|rejected`, `brokerStatus=not_required|requested|approved|rejected`, `confidence 0-100`
- **Plans:** dual `plans.ts` (storage metering) + `plan-limits.ts` (feature gates `bulk_upload, broker_handoff, cross_check, api_access`, lanes). Merge pending.

---

## Endpoints for workflow

- `GET /api/shopify/auth?shop=` → redirect Shopify, `GET /api/shopify/callback` → exchange, `POST /api/shopify/webhooks/orders` + `app-uninstalled`, `POST /api/shopify/ingest` (demo), `GET /api/shopify/orders` (shops/orders/decisions), `GET /api/shopify/decisions?orderId=` + `GET /api/shopify/decisions/[id]` + `.../pdf?type=` + `.../carrier?format=` + `.../approve` + `.../broker`, `GET /api/health`.
