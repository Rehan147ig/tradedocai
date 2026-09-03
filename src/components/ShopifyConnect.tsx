"use client";

import { useState } from "react";
import { parseShopInput } from "@/lib/shopify/verify";

export function ShopifyConnect({ onConnected, compact = false }: { onConnected?: () => void; compact?: boolean }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function go() {
    const p = parseShopInput(input);
    if (!p.domain) { setError(p.error ?? "Check store name"); return; }
    setError("");
    setLoading(true);
    location.href = `/api/shopify/auth?shop=${encodeURIComponent(p.domain)}`;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            className="input"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (error) setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="mystore  or  mystore.myshopify.com  or  https://mystore.myshopify.com"
            style={{ paddingLeft: 36 }}
            aria-label="Shopify store"
          />
          <span style={{ position: "absolute", left: 10, top: 12, fontSize: 14 }}>🛍️</span>
          {input && (
            <button onClick={() => setInput("")} style={{ position: "absolute", right: 8, top: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, padding: "4px 6px" }}>Clear</button>
          )}
        </div>
        <button className="button" onClick={go} disabled={loading} style={{ minWidth: compact ? 110 : 160, background: "var(--green, #16a34a)", borderColor: "var(--green, #16a34a)" }}>
          {loading ? "Connecting…" : compact ? "Connect →" : "Connect store →"}
        </button>
      </div>
      {error ? <p style={{ color: "var(--red)", fontSize: 12, margin: "6px 0 0" }}>{error}</p> : <p className="muted" style={{ fontSize: 11, margin: "6px 0 0" }}>Paste anything — we add <code>.myshopify.com</code> for you. No typing full URL needed. {compact ? "" : "Find it in Shopify admin top bar."}</p>}
      {!compact ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="https://apps.shopify.com/search?q=ClearShip" target="_blank" className="button secondary" style={{ fontSize: 11, padding: "6px 10px", textDecoration: "none" }}>Install via App Store (1 click) →</a>
          <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>or type above.</span>
        </div>
      ) : null}
    </div>
  );
}
