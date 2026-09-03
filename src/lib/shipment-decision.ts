import { prisma } from "@/lib/db";
import { applyLaneRules, estimateLandedCost, inferLane, TradeLane } from "@/lib/lane-rules";
import { applyProductMemory } from "@/lib/product-memory";
import { extractRuleFieldsFromText, ruleFlagsToDocumentFlags, runRuleEngine } from "@/lib/rule-engine";
import { validateTradeDocument } from "@/lib/validators";
import { runInterfazeDecision } from "@/lib/interfaze";
import { buildCarrierPayload, shopifyOrderToExtractedDoc, ShopifyOrderPayload } from "@/lib/shopify/transform";
import { checkRestricted, restrictedHitsToFlags } from "@/lib/restricted";

export interface RunDecisionInput {
  userId: string;
  shopId?: string;
  shopDomain?: string;
  shopifyOrderId?: string;
  shopifyOrderNumber?: string;
  shopifyOrder?: ShopifyOrderPayload;
  documentText?: string;
  selectedLane?: TradeLane;
  documentId?: string;
}

export async function runShipmentDecision(input: RunDecisionInput) {
  const started = performance.now();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  let extractedPreview: ReturnType<typeof shopifyOrderToExtractedDoc>;

  if (input.shopifyOrder) {
    extractedPreview = shopifyOrderToExtractedDoc(input.shopifyOrder);
    // enrich seller from Shopify shop address or user — no hardcoded India
    const shopAddress = input.shopifyOrder?.shipping_address as Record<string, unknown> | null; // placeholder: real shop fetch happens via shopify client if shopId present
    let sellerCountry: string | null = null;
    // 1) Try to fetch Shop's primary location via Shopify API if we have a shop token
    if (input.shopId && input.shopDomain) {
      try {
        const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
        if (shop?.accessToken && input.shopDomain) {
          // Light fetch — no throw on fail; fallback to user/userCompany
          const { shopifyFetch } = await import("@/lib/shopify/client");
          const shopData = await shopifyFetch(input.shopDomain, shop.accessToken, "/shop.json").catch(() => null) as { shop?: { country_name?: string; country?: string; iana_timezone?: string } } | null;
          sellerCountry = shopData?.shop?.country_name ?? shopData?.shop?.country ?? null;
        }
      } catch {}
    }
    // 2) Fallback chain: user.companyName/ship? profile country, or infer from lane later (global lane)
    extractedPreview.seller_name = user.companyName ?? user.fullName ?? user.email;
    extractedPreview.seller_country = sellerCountry ?? (user as unknown as Record<string, string | null>).companyCountry ?? null;
    extractedPreview.seller_address = (user as unknown as Record<string, string | null>).companyAddress ?? null;
  } else if (input.documentText) {
    const deterministic = extractRuleFieldsFromText(input.documentText);
    extractedPreview = deterministic as unknown as typeof extractedPreview;
  } else {
    throw new Error("Either shopifyOrder or documentText required");
  }

  const preCheck = runRuleEngine(extractedPreview);
  const lane = input.selectedLane ?? inferLane(extractedPreview);

  // Interfaze deterministic orchestrator: delegates HS semantic if needed
  const interfaze = await runInterfazeDecision({
    source: input.shopifyOrder ? "shopify_order" : "pdf_document",
    shopDomain: input.shopDomain,
    orderId: input.shopifyOrderId,
    orderJson: input.shopifyOrder,
    documentText: input.documentText,
    ruleFlags: preCheck.flags,
    extractedPreview: extractedPreview as unknown as import("@/lib/validators").ExtractedTradeDocument,
    lane,
    userId: input.userId,
  });

  // Merge: start from interfaze data (or preview), re-apply deterministic stack for audit
  let data: import("@/lib/validators").ExtractedTradeDocument = interfaze.data as import("@/lib/validators").ExtractedTradeDocument;
  // Ensure flags from rule engine are preserved
  data.flags = [...ruleFlagsToDocumentFlags(preCheck.flags), ...(data.flags ?? [])];
  data.rule_score = preCheck.score;
  data.rule_status = preCheck.status;
  data.passing_checks = preCheck.passingChecks;

  const products = await prisma.product.findMany({ where: { userId: input.userId } });
  const withMemory = applyProductMemory(data, products);
  const withLane = applyLaneRules(withMemory, lane);
  const withRestrictedHits = await checkRestricted(withLane, lane);
  const restrictedFlags = restrictedHitsToFlags(withRestrictedHits);
  if (restrictedFlags.length) withLane.flags = [...(withLane.flags ?? []), ...restrictedFlags];
  const validated = validateTradeDocument(withLane);
  const finalLane = input.selectedLane ?? inferLane(validated);
  const landedCost = estimateLandedCost(validated, finalLane);
  const enriched = { ...validated, trade_lane: finalLane, landed_cost: landedCost, restricted_hits: withRestrictedHits } as unknown as typeof validated & { restricted_hits: typeof withRestrictedHits };
  const carrierPayload = input.shopifyOrder ? buildCarrierPayload(enriched as unknown as import("@/lib/validators").ExtractedTradeDocument, input.shopifyOrder as ShopifyOrderPayload) : null;

  // HS recommendations with confidence
  const hsRecommendations = enriched.items.map((it, idx) => ({
    line: idx + 1,
    description: it.description,
    hs_code: it.hs_code,
    hs_status: it.hs_status,
    confidence: enriched.confidence ?? preCheck.score,
    needsReview: !it.hs_code || it.hs_status !== "valid" || (enriched.confidence ?? 0) < 85,
    source: it.hs_code ? (products.find((p) => p.hsCode.replace(/[.\s]/g, "") === String(it.hs_code).replace(/[.\s]/g, "")) ? "product_memory" : "interfaze_ai") : "missing",
  }));

  const status = validated.status === "ready_to_ship" ? "ready" : validated.status === "critical_issues" ? "critical" : "needs_review";

  const decision = await prisma.shipmentDecision.create({
    data: {
      userId: input.userId,
      shopId: input.shopId ?? null,
      shopDomain: input.shopDomain ?? null,
      shopifyOrderId: input.shopifyOrderId ?? null,
      documentId: input.documentId ?? null,
      shopifyOrderNumber: input.shopifyOrderNumber ?? null,
      lane: finalLane,
      status,
      confidence: Number(validated.confidence ?? 0),
      hsRecommendationsJson: JSON.stringify(hsRecommendations),
      flagsJson: JSON.stringify(validated.flags ?? []),
      auditTrailJson: JSON.stringify({
        ...interfaze.auditTrail,
        lane: finalLane,
        landedCost,
        carrierPayload,
        passingChecks: preCheck.passingChecks,
        restrictedHits: withRestrictedHits,
      }),
      inputJson: JSON.stringify(input.shopifyOrder ?? { documentText: input.documentText?.slice(0, 2000) }),
      outputJson: JSON.stringify(enriched),
      interfazeRunId: interfaze.runId,
      interfazeWorkflow: interfaze.workflowId,
      processingTimeMs: Math.round(performance.now() - started),
      carrierPayloadJson: JSON.stringify(carrierPayload ?? {}),
    },
  });

  return { decision, enriched, hsRecommendations, landedCost, interfaze, carrierPayload, restrictedHits: withRestrictedHits };
}
