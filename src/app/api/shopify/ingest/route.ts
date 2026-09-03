import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runShipmentDecision } from "@/lib/shipment-decision";
import { TradeLane, TRADE_LANES } from "@/lib/lane-rules";
import { ShopifyOrderPayload } from "@/lib/shopify/transform";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Accept either raw Shopify order payload or { order, lane, shopDomain }
  const order: ShopifyOrderPayload | null = (body.order as ShopifyOrderPayload) ?? (body.id ? (body as ShopifyOrderPayload) : null);
  if (!order || !order.id) return NextResponse.json({ error: "Provide Shopify order JSON with id" }, { status: 400 });

  const laneRaw = String(body.lane ?? "global");
  const lane: TradeLane = laneRaw in TRADE_LANES ? (laneRaw as TradeLane) : "global";
  const shopDomain: string | undefined = body.shopDomain ? String(body.shopDomain).toLowerCase() : undefined;

  let shop = null;
  if (shopDomain) shop = await prisma.shop.findUnique({ where: { shopDomain } });

  // Persist order snapshot
  try {
    if (shop) {
      await prisma.shopifyOrder.upsert({
        where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: String(order.id) } },
        update: {
          shopifyOrderNumber: order.order_number?.toString() ?? order.name ?? null,
          currency: order.currency ?? null,
          totalPrice: String(order.total_price ?? ""),
          lineItemsJson: JSON.stringify(order.line_items ?? []),
          rawPayloadJson: JSON.stringify(order).slice(0, 50000),
        },
        create: {
          shopId: shop.id,
          shopDomain: shop.shopDomain,
          shopifyOrderId: String(order.id),
          shopifyOrderNumber: order.order_number?.toString() ?? order.name ?? null,
          currency: order.currency ?? null,
          totalPrice: String(order.total_price ?? ""),
          lineItemsJson: JSON.stringify(order.line_items ?? []),
          rawPayloadJson: JSON.stringify(order).slice(0, 50000),
        },
      });
    }
  } catch (e) {
    console.warn("[ingest] order persist failed", e);
  }

  try {
    const result = await runShipmentDecision({
      userId: user.id,
      shopId: shop?.id,
      shopDomain: shop?.shopDomain ?? shopDomain,
      shopifyOrderId: String(order.id),
      shopifyOrderNumber: order.order_number?.toString() ?? order.name,
      shopifyOrder: order,
      selectedLane: lane,
    });
    return NextResponse.json(
      {
        decisionId: result.decision.id,
        status: result.decision.status,
        confidence: result.decision.confidence,
        lane: result.decision.lane,
        hsRecommendations: result.hsRecommendations,
        restrictedHits: result.restrictedHits,
        landedCost: result.landedCost,
        carrierPayload: result.carrierPayload,
        auditTrail: JSON.parse(result.decision.auditTrailJson),
        output: result.enriched,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
