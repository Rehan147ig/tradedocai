import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyHmac } from "@/lib/shopify/verify";
import { prisma } from "@/lib/db";
import { enqueueShipmentDecision } from "@/lib/queue";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? process.env.SHOPIFY_API_SECRET ?? "";

  if (secret && !verifyShopifyHmac(raw, hmac, secret)) {
    return NextResponse.json({ error: "HMAC invalid" }, { status: 401 });
  }

  let order: Record<string, unknown>;
  try {
    order = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain.toLowerCase() } });
  if (!shop) {
    console.warn("[shopify webhook] shop not found", shopDomain);
    return NextResponse.json({ received: true, shopNotFound: true });
  }

  const orderId = String((order.id as string | number) ?? "");
  const orderName = (order.name as string) ?? null;
  const orderNumber = (order.order_number as number | undefined)?.toString() ?? null;

  // Persist ShopifyOrder
  try {
    await prisma.shopifyOrder.upsert({
      where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
      update: {
        shopifyOrderNumber: orderNumber,
        orderName,
        email: (order.email as string) ?? null,
        currency: (order.currency as string) ?? null,
        totalPrice: String((order as Record<string, unknown>).total_price ?? ""),
        subtotalPrice: String((order as Record<string, unknown>).subtotal_price ?? ""),
        totalTax: String((order as Record<string, unknown>).total_tax ?? ""),
        financialStatus: (order.financial_status as string) ?? null,
        fulfillmentStatus: (order.fulfillment_status as string) ?? null,
        destinationCountry: ((order.shipping_address as Record<string, string> | null)?.country ?? (order as Record<string, unknown>).presentment_currency as string) ?? null,
        shippingAddressJson: JSON.stringify(order.shipping_address ?? {}),
        billingAddressJson: JSON.stringify(order.billing_address ?? {}),
        lineItemsJson: JSON.stringify(order.line_items ?? []),
        rawPayloadJson: raw.slice(0, 50000),
        shopifyCreatedAt: (order.created_at as string) ? new Date(order.created_at as string) : null,
      },
      create: {
        shopId: shop.id,
        shopDomain: shop.shopDomain,
        shopifyOrderId: orderId,
        shopifyOrderNumber: orderNumber,
        orderName,
        email: (order.email as string) ?? null,
        currency: (order.currency as string) ?? null,
        totalPrice: String((order as Record<string, unknown>).total_price ?? ""),
        subtotalPrice: String((order as Record<string, unknown>).subtotal_price ?? ""),
        totalTax: String((order as Record<string, unknown>).total_tax ?? ""),
        financialStatus: (order.financial_status as string) ?? null,
        fulfillmentStatus: (order.fulfillment_status as string) ?? null,
        destinationCountry: ((order.shipping_address as Record<string, string> | null)?.country ?? null) as string | null,
        shippingAddressJson: JSON.stringify(order.shipping_address ?? {}),
        billingAddressJson: JSON.stringify(order.billing_address ?? {}),
        lineItemsJson: JSON.stringify(order.line_items ?? []),
        rawPayloadJson: raw.slice(0, 50000),
        shopifyCreatedAt: (order.created_at as string) ? new Date(order.created_at as string) : null,
      },
    });
  } catch (e) {
    console.error("[shopify webhook] upsert order failed", e);
  }

  // Background queue — instant 200 OK for Shopify (5-sec deadline), survives 500-webhook bursts
  const { mode } = await enqueueShipmentDecision({
    userId: shop.userId,
    shopId: shop.id,
    shopDomain: shop.shopDomain,
    shopifyOrderId: orderId,
    shopifyOrderNumber: orderNumber ?? orderName,
    shopifyOrder: order as unknown as import("@/lib/shopify/transform").ShopifyOrderPayload,
  });

  return NextResponse.json({ received: true, orderId, queued: mode });
}
