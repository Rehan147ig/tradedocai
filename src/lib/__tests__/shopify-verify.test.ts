import { describe, it, expect } from "vitest";
import { verifyShopifyHmac, verifyShopifyOAuthHmac, sanitizeShopDomain } from "@/lib/shopify/verify";
import crypto from "crypto";

describe("shopify verify", () => {
  it("sanitizeShopDomain", () => {
    expect(sanitizeShopDomain("my-store.myshopify.com")).toBe("my-store.myshopify.com");
    expect(sanitizeShopDomain("evil.com")).toBeNull();
    expect(sanitizeShopDomain("  MY-STORE.MYSHOPIFY.COM ")).toBe("my-store.myshopify.com");
  });
  it("verifyShopifyHmac timing-safe", () => {
    const secret = "shpss_test";
    const raw = '{"id":123}';
    const hmac = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    expect(verifyShopifyHmac(raw, hmac, secret)).toBe(true);
    expect(verifyShopifyHmac(raw, "bad", secret)).toBe(false);
  });
  it("verifyShopifyOAuthHmac", () => {
    const secret = "secret123";
    const q = { shop: "test.myshopify.com", code: "abc", timestamp: "123" } as Record<string,string>;
    const msg = Object.keys(q).sort().map(k=>`${k}=${q[k]}`).join("&");
    const hmac = crypto.createHmac("sha256", secret).update(msg).digest("hex");
    expect(verifyShopifyOAuthHmac({ ...q, hmac }, secret)).toBe(true);
    expect(verifyShopifyOAuthHmac({ ...q, hmac: "bad" }, secret)).toBe(false);
  });
});
