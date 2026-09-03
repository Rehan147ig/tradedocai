import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchShopifyOrders } from "@/lib/shopify/client";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shopDomain = request.nextUrl.searchParams.get("shop");
  const where: Record<string, unknown> = { userId: user.id };
  if (shopDomain) where.shopDomain = shopDomain.toLowerCase();

  const [shops, orders, decisions] = await Promise.all([
    prisma.shop.findMany({ where: { userId: user.id }, select: { shopDomain: true, isActive: true, scope: true, installedAt: true } }),
    prisma.shopifyOrder.findMany({ where: where as never, orderBy: { shopifyCreatedAt: "desc" }, take: 50 }),
    prisma.shipmentDecision.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, shopifyOrderId: true, status: true, confidence: true, lane: true, createdAt: true } }),
  ]);

  // Optionally live fetch from Shopify if shop specified and token exists
  let live: unknown = null;
  if (shopDomain) {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain.toLowerCase() } });
    if (shop?.accessToken) {
      try {
        live = await fetchShopifyOrders(shop.shopDomain, shop.accessToken, 10);
      } catch (e) {
        live = { error: (e as Error).message };
      }
    }
  }

  return NextResponse.json({ shops, orders, decisions, live });
}
