"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TourButton, useAutoTour } from "@/components/Tour";
import { ShopifyConnect } from "@/components/ShopifyConnect";

type Shop = { shopDomain: string; isActive: boolean; installedAt: string };
type Decision = { id: string; shopifyOrderId: string | null; shopifyOrderNumber: string | null; status: string; confidence: number; lane: string; createdAt: string; approvalStatus?: string; brokerStatus?: string; auditTrail: { restrictedHits?: Array<{ title: string; severity: string }> } };

export default function ShopifyPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [shopInput, setShopInput] = useState("");
  const [msg, setMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ingestJson, setIngestJson] = useState('{\n  "id": 123456789,\n  "name": "#1001",\n  "currency": "GBP",\n  "total_price": "149.00",\n  "line_items": [{ "title": "Cotton T-Shirt", "quantity": 2, "price": "74.50", "sku": "TSH-COT-001" }],\n  "shipping_address": { "first_name": "John", "last_name": "Doe", "address1": "10 Downing St", "city": "London", "country": "United Kingdom", "zip": "SW1A 2AA" }\n}');
  const [loading, setLoading] = useState(false);
  const autoTour = useAutoTour("shopify", 1200);

  async function load() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) { location.href = "/login"; return; }
    const res = await fetch("/api/shopify/orders", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) { setShops(data.shops ?? []); }
    const dec = await fetch("/api/shopify/decisions", { headers: { Authorization: `Bearer ${token}` } });
    const ddata = await dec.json();
    if (dec.ok) setDecisions(ddata.decisions ?? []);
  }

  useEffect(() => { load(); const q = new URLSearchParams(location.search); if (q.get("connected")) setMsg("✅ Shopify connected! Orders will now be checked automatically."); autoTour(); }, []);

  async function ingest() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    setLoading(true); setMsg("");
    try {
      const order = JSON.parse(ingestJson);
      const res = await fetch("/api/shopify/ingest", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ order, shopDomain: shops[0]?.shopDomain }) });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setMsg("❌ " + (data.error ?? "Could not check order")); return; }
      setMsg(`✅ Checked ${data.shopifyOrderNumber ?? data.decisionId.slice(0, 8)} — ${plainStatus(data.status)} (${data.confidence}%). ${data.restrictedHits?.length ? "⚠️ Restricted item flagged." : "Tap Review to print."}`);
      load();
    } catch (e) { setLoading(false); setMsg((e as Error).message); }
  }

  async function approve(id: string, action: string) {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    const res = await fetch(`/api/shopify/decisions/${id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (res.ok) load(); else setMsg("Approval failed");
  }

  function plainStatus(s: string) { return s === "ready" ? "Ready to ship" : s === "critical" ? "Fix needed" : s === "needs_review" ? "Needs quick check" : s; }

  const stats = { ready: decisions.filter((d) => d.status === "ready").length, review: decisions.filter((d) => d.status === "needs_review").length, critical: decisions.filter((d) => d.status === "critical").length };

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <div id="tour-shopify-hero" className="panel dashboard-cta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div className="eyebrow">Shopify ClearShip AI — Easy in 3 steps</div>
            <h2 style={{ margin: "6px 0" }}>No more customs surprises.</h2>
            <p className="muted" style={{ margin: 0 }}>We check every international order: HS code, duties, restricted items, and give you 1-click docs. <strong>Interfaze.AI does the boring checks locally — AI only for HS wording.</strong></p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <TourButton tourId="shopify" label="Take 60-sec tour" variant="primary" />
            <a className="button secondary" href="/shopify" onClick={(e) => { e.preventDefault(); document.getElementById("orders")?.scrollIntoView({ behavior: "smooth" }); }}>See orders →</a>
          </div>
        </div>

        {msg ? <div className="panel" style={{ padding: 12, margin: "16px 0", borderLeft: "4px solid var(--accent)" }}>{msg}</div> : null}

        <div className="metrics" style={{ marginBottom: 16 }}>
          <div className="metric"><span className="muted">Ready to ship</span><strong style={{ color: "var(--green)" }}>{stats.ready}</strong></div>
          <div className="metric"><span className="muted">Needs check</span><strong style={{ color: "orange" }}>{stats.review}</strong></div>
          <div className="metric"><span className="muted">Fix needed</span><strong style={{ color: "var(--red)" }}>{stats.critical}</strong></div>
          <div className="metric"><span className="muted">Stores</span><strong>{shops.length || "—"}</strong></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <section id="tour-connect" className="panel" style={{ padding: 18, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: shops.length ? "var(--green)" : "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 700 }}>{shops.length ? "✓" : "1"}</div>
            <h3 style={{ margin: "6px 0" }}>{shops.length ? "Store connected" : "Connect store"}</h3>
            <p className="muted" style={{ fontSize: 12 }}>{shops.length ? "Orders sync automatically. No code." : "Paste anything — we fix the rest. 15 seconds."}</p>
            <div style={{ marginTop: 10, textAlign: "left" }}>
              {shops.length ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10, fontSize: 12 }}><span style={{ color: "var(--green)", fontWeight: 700 }}>✅ {shops[0].shopDomain}</span> — live. <a href="/shopify" onClick={(e) => { e.preventDefault(); setShopInput(""); }} style={{ textDecoration: "underline", marginLeft: 6 }}>Connect another</a></div>
              ) : (
                <ShopifyConnect />
              )}
            </div>
          </section>
          <section id="tour-demo" className="panel" style={{ padding: 18, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: shops.length ? "var(--green)" : "#e5e7eb", color: shops.length ? "white" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 700 }}>{shops.length ? "✓" : "2"}</div>
            <h3 style={{ margin: "6px 0" }}>Orders checked</h3>
            <p className="muted" style={{ fontSize: 12 }}>{shops.length ? "Webhook is live — check happens on orders/create." : "Demo: click Battery or Cosmetics below, then Run check."}</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
              <button className="button" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => setIngestJson('{\n  "id": 9001,\n  "name": "#BATT-01",\n  "currency": "USD",\n  "total_price": "299.00",\n  "line_items": [{ "title": "Lithium Power Bank 20000mAh", "quantity": 1, "price": "299.00", "sku": "PWR-LI-20K" }],\n  "shipping_address": { "first_name": "Alex", "last_name": "Smith", "address1": "1 Market St", "city": "New York", "country": "United States", "zip": "10001" }\n}')}>🔋 Battery</button>
              <button className="button" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => setIngestJson('{\n  "id": 9002,\n  "name": "#COSM-02",\n  "currency": "EUR",\n  "total_price": "89.00",\n  "line_items": [{ "title": "Vitamin C Face Serum 30ml", "quantity": 1, "price": "89.00", "sku": "SER-VITC-01" }],\n  "shipping_address": { "first_name": "Marie", "last_name": "Dubois", "address1": "10 Rue de Rivoli", "city": "Paris", "country": "France", "zip": "75001" }\n}')}>🧴 Cosmetics→EU</button>
              <button className="button" style={{ fontSize: 11, padding: "6px 10px", background: "var(--green)", color: "white" }} onClick={ingest} disabled={loading}>{loading ? "Checking…" : "Run check →"}</button>
            </div>
          </section>
          <section className="panel" style={{ padding: 18, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: stats.ready ? "var(--green)" : "#e5e7eb", color: stats.ready ? "white" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 700 }}>3</div>
            <h3 style={{ margin: "6px 0" }}>Approve & ship</h3>
            <p className="muted" style={{ fontSize: 12 }}>Teammate approves, broker link if needed, 1-click invoice & carrier file.</p>
            <a href="#orders" className="button" style={{ fontSize: 11, marginTop: 10 }}>{decisions.length ? `Review ${decisions.length} orders` : "No orders yet"}</a>
          </section>
        </div>

        <section id="tour-orders" className="panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Your international orders</h3>
            <span className="muted" style={{ fontSize: 11 }}>Most recent · tap Review for plain-English fix + print</span>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Order</th><th>Goes to</th><th>What’s up</th><th>Docs</th><th id="tour-approve">Approve</th></tr></thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.id}>
                    <td><a href={`/shopify/${d.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>{d.shopifyOrderNumber ?? d.shopifyOrderId?.slice(0, 6) ?? d.id.slice(0, 6)}</a><div className="muted" style={{ fontSize: 11 }}>{d.lane} · {d.confidence}% sure</div></td>
                    <td>{(decisions.find(() => false) as unknown as string) ?? d.lane.replace("-", " → ")}</td>
                    <td>
                      <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: d.status === "ready" ? "#dcfce7" : d.status === "critical" ? "#fee2e2" : "#fef3c7", color: d.status === "ready" ? "#166534" : d.status === "critical" ? "#991b1b" : "#92400e" }}>{plainStatus(d.status)}</span>
                      {d.auditTrail?.restrictedHits?.length ? <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>⚠️ {d.auditTrail.restrictedHits[0].title}</div> : null}
                    </td>
                    <td><a href={`/shopify/${d.id}`} className="button" style={{ padding: "6px 10px", fontSize: 12 }}>Review & print →</a></td>
                    <td>
                      {d.approvalStatus === "approved" ? <span style={{ color: "var(--green)", fontSize: 12 }}>✅ Approved</span> : d.approvalStatus === "rejected" ? <span style={{ color: "var(--red)", fontSize: 12 }}>Rejected</span> : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="button" style={{ padding: "4px 8px", fontSize: 11, background: "var(--green)", color: "white" }} onClick={() => approve(d.id, "approve")}>Approve</button>
                          <button className="button" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => approve(d.id, "reject")}>Ask fix</button>
                        </div>
                      )}
                      {d.brokerStatus === "requested" ? <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>Broker: waiting</div> : null}
                    </td>
                  </tr>
                ))}
                {decisions.length === 0 ? <tr><td colSpan={5}><div style={{ textAlign: "center", padding: 16 }}><p style={{ fontSize: 14 }}>No orders checked yet. That’s normal.</p><p className="muted" style={{ fontSize: 12 }}>Connect your store above, or click <strong>Battery</strong> + <strong>Run check</strong> to see a demo in 5 seconds.</p></div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{ fontSize: 11, background: "transparent", color: "#64748b", border: "1px solid #e2e8f0" }}>{showAdvanced ? "Hide technical details" : "Show technical JSON (for devs)"}</button>
        </div>
        {showAdvanced ? (
          <section className="panel" style={{ padding: 16, marginTop: 12 }}>
            <h4 style={{ margin: 0 }}>Advanced — raw Shopify JSON ingest (Interfaze pipeline)</h4>
            <p className="muted" style={{ fontSize: 11 }}>Only if you want to paste real Shopify order JSON. Normal users never need this.</p>
            <textarea className="input textarea" value={ingestJson} onChange={(e) => setIngestJson(e.target.value)} rows={8} style={{ fontFamily: "monospace", fontSize: 11 }} />
            <button className="button" onClick={ingest} disabled={loading} style={{ marginTop: 8 }}>{loading ? "Running…" : "Run raw ingest"}</button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
