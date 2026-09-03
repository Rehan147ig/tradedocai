import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyOAuthHmac, sanitizeShopDomain } from "@/lib/shopify/verify";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { registerWebhooks } from "@/lib/shopify/client";

export async function GET(request: NextRequest) {
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { shop, code, hmac } = params as Record<string, string>;

  if (!shop || !code || !hmac) return NextResponse.json({ error: "Missing shop/code/hmac" }, { status: 400 });

  const sanitized = sanitizeShopDomain(shop);
  if (!sanitized) return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });

  if (!verifyShopifyOAuthHmac(params, secret)) return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });

  // Find authed user from cookie token or Bearer (allows app store flow without Bearer)
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;
  const queryState = request.nextUrl.searchParams.get("state");
  if (cookieState && queryState && cookieState !== queryState) {
    // warn but not hard fail for app store installs
    console.warn("[shopify] state mismatch", { cookieState, queryState });
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${sanitized}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, client_secret: secret, code }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text().catch(() => "");
    return NextResponse.json({ error: `Token exchange failed ${tokenRes.status}: ${t.slice(0, 300)}` }, { status: 400 });
  }
  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;
  const scope: string = tokenData.scope ?? "";

  // Associate to logged-in user if present, else create/link by shopDomain
  let user = await getUserFromRequest(request);
  if (!user) {
    // Try to find existing shop owner
    const existing = await prisma.shop.findUnique({ where: { shopDomain: sanitized }, include: { user: true } });
    if (existing) user = existing.user;
  }
  if (!user) {
    // Fallback: need login. Redirect to login with shop param
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("shop", sanitized);
    loginUrl.searchParams.set("shopify_pending", "1");
    // store token temp in cookie for post-login link
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("shopify_pending_token", accessToken, { httpOnly: true, maxAge: 600, path: "/" });
    res.cookies.set("shopify_pending_scope", scope, { httpOnly: true, maxAge: 600, path: "/" });
    return res;
  }

  await prisma.shop.upsert({
    where: { shopDomain: sanitized },
    update: { accessToken, scope, isActive: true, uninstalledAt: null, userId: user.id },
    create: { shopDomain: sanitized, accessToken, scope, userId: user.id },
  });

  try {
    await registerWebhooks(sanitized, accessToken);
  } catch (e) {
    console.warn("[shopify] webhook register after callback failed", e);
  }

  const successUrl = new URL("/shopify", appUrl);
  successUrl.searchParams.set("shop", sanitized);
  successUrl.searchParams.set("connected", "1");
  return NextResponse.redirect(successUrl);
}
