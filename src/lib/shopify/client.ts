import { prisma } from "@/lib/db";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

export async function getShopByDomain(shopDomain: string) {
  return prisma.shop.findUnique({ where: { shopDomain: shopDomain.toLowerCase() } });
}

export async function shopifyFetch(shopDomain: string, accessToken: string, path: string, init?: RequestInit) {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify ${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

export async function fetchShopifyOrder(shopDomain: string, accessToken: string, orderId: string) {
  const data = await shopifyFetch(shopDomain, accessToken, `/orders/${orderId}.json`);
  return data.order;
}

export async function fetchShopifyOrders(shopDomain: string, accessToken: string, limit = 20) {
  const data = await shopifyFetch(shopDomain, accessToken, `/orders.json?status=any&limit=${limit}`);
  return data.orders as unknown[];
}

export async function registerWebhooks(shopDomain: string, accessToken: string) {
  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  if (!appUrl) return;
  const webhooks = [
    { topic: "orders/create", address: `${appUrl}/api/shopify/webhooks/orders` },
    { topic: "app/uninstalled", address: `${appUrl}/api/shopify/webhooks/app-uninstalled` },
  ];
  for (const wh of webhooks) {
    try {
      await shopifyFetch(shopDomain, accessToken, "/webhooks.json", {
        method: "POST",
        body: JSON.stringify({ webhook: wh }),
      });
    } catch (e) {
      console.warn("[shopify] webhook register failed", wh.topic, e);
    }
  }
}
