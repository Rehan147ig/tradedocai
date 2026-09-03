import crypto from "crypto";

export function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export function verifyShopifyOAuthHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

export function sanitizeShopDomain(shop: string): string | null {
  const raw = shop.trim().toLowerCase();
  // Extract domain if full URL pasted (only if myshopify)
  const fromUrl = (() => {
    try {
      const hasProtocol = raw.startsWith("http://") || raw.startsWith("https://");
      if (!hasProtocol && !raw.includes("/")) return null;
      const u = new URL(hasProtocol ? raw : `https://${raw}`);
      const h = u.hostname.toLowerCase();
      if (h.endsWith(".myshopify.com")) return h;
      return null;
    } catch {}
    return null;
  })();
  const s = fromUrl ?? raw;
  // Allow "mystore" → "mystore.myshopify.com" (most common ease win); keep dot-check strict for evil.com
  const withDomain = s.includes(".") ? s : `${s}.myshopify.com`;
  const normalized = withDomain.replace(/^https?:\/\//, "").split("/")[0].split("?")[0].split("#")[0];
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized)) return null;
  return normalized;
}

export function parseShopInput(input: string): { domain: string | null; error?: string } {
  const t = input.trim();
  if (!t) return { domain: null, error: "Enter your store name" };
  if (t.includes("@")) return { domain: null, error: "Shopify stores use your-store.myshopify.com — not an email. Find it at admin.shopify.com (top bar)." };
  const d = sanitizeShopDomain(t);
  if (!d) return { domain: null, error: "Use like mystore or mystore.myshopify.com" };
  return { domain: d };
}
