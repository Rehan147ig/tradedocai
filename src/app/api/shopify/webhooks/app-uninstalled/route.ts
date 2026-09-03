import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyHmac } from "@/lib/shopify/verify";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? process.env.SHOPIFY_API_SECRET ?? "";
  if (secret && !verifyShopifyHmac(raw, hmac, secret)) return NextResponse.json({ error: "HMAC invalid" }, { status: 401 });

  const domain = shopDomain.toLowerCase();
  if (domain) {
    await prisma.shop.updateMany({ where: { shopDomain: domain }, data: { isActive: false, uninstalledAt: new Date() } });
  }
  return NextResponse.json({ received: true });
}
