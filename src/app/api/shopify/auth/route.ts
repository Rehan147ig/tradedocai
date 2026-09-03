import { NextRequest, NextResponse } from "next/server";
import { sanitizeShopDomain } from "@/lib/shopify/verify";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop") ?? "";
  const sanitized = sanitizeShopDomain(shop);
  if (!sanitized) return NextResponse.json({ error: "Invalid shop. Paste like mystore, mystore.myshopify.com, or https://mystore.myshopify.com — not an email." }, { status: 400 });

  const apiKey = process.env.SHOPIFY_API_KEY;
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  const scopes = process.env.SHOPIFY_SCOPES ?? "read_orders,read_products,write_orders";

  if (!apiKey || !appUrl) return NextResponse.json({ error: "SHOPIFY_API_KEY or SHOPIFY_APP_URL not configured" }, { status: 500 });

  const state = Math.random().toString(36).slice(2, 12);
  const redirectUri = `${appUrl}/api/shopify/callback`;
  const url = `https://${sanitized}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  const res = NextResponse.redirect(url);
  res.cookies.set("shopify_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  res.cookies.set("shopify_shop", sanitized, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
