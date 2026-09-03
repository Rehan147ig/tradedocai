"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { Stepper } from "@/components/Stepper";
import { TourButton, useAutoTour } from "@/components/Tour";

type DecisionDetail = {
  id: string; shopifyOrderId: string | null; shopifyOrderNumber: string | null; lane: string; status: string; confidence: number; createdAt: string; approvalStatus?: string; approvedBy?: string | null; brokerStatus?: string; brokerToken?: string | null; brokerEmail?: string | null;
  hsRecommendations: Array<{ line: number; description: string; hs_code: string | null; hs_status: string; confidence: number; needsReview: boolean; source: string }>;
  flags: Array<{ severity: string; field: string; title: string; fix: string; source?: string; link?: string }>;
  auditTrail: { workflowId?: string; runId?: string; provider?: string; lane?: string; landedCost?: { laneLabel: string; invoiceValue: number; estimatedDuty: number; estimatedTax: number; estimatedLandedCost: number; currency: string; assumptions: string[] }; carrierPayload?: unknown; restrictedHits?: Array<{ category: string; title: string; body: string; severity: string; sourceUrl?: string }>; steps?: Array<{ name: string; status: string; reason?: string }>; ruleIds?: string[]; passingChecks?: string[] };
  output: { invoice_number?: string; seller_name?: string; buyer_name?: string; buyer_address?: string; buyer_country?: string; total_value?: string; currency?: string; incoterms?: string; items?: Array<{ description: string; hs_code?: string | null; country_of_origin?: string | null; quantity?: string | null }> };
  carrierPayload: unknown;
};

export default function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<DecisionDetail | null>(null);
  const [carrierFmt, setCarrierFmt] = useState("generic");
  const [carrierJson, setCarrierJson] = useState<unknown>(null);
  const [msg, setMsg] = useState("");

  const [brokerEmail, setBrokerEmail] = useState("");
  const [brokerMsg, setBrokerMsg] = useState("");
  const autoTour = useAutoTour("decision", 1000);

  async function load() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) { location.href = "/login"; return; }
    const res = await fetch(`/api/shopify/decisions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) {
      const dec = data.decision;
      setD({
        id: dec.id, shopifyOrderId: dec.shopifyOrderId, shopifyOrderNumber: dec.shopifyOrderNumber, lane: dec.lane, status: dec.status, confidence: dec.confidence, createdAt: dec.createdAt,
        approvalStatus: dec.approvalStatus ?? "pending", approvedBy: dec.approvedBy ?? null, brokerStatus: dec.brokerStatus ?? "not_required", brokerToken: dec.brokerToken ?? null, brokerEmail: dec.brokerEmail ?? null,
        hsRecommendations: dec.hsRecommendations ?? [], flags: dec.flags ?? [], auditTrail: dec.auditTrail ?? {}, output: dec.output ?? {}, carrierPayload: dec.carrierPayload,
      });
    } else setMsg(data.error ?? "Not found");
  }

  async function act(action: string) {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    const res = await fetch(`/api/shopify/decisions/${id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (res.ok) { setMsg(action === "approve" ? "✅ Approved — ready to print." : "Noted — needs fix."); load(); }
  }

  async function inviteBroker() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    const res = await fetch(`/api/shopify/decisions/${id}/broker`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ brokerEmail, note: "Please review — ClearShip flagged this order." }) });
    const data = await res.json();
    if (res.ok) { setBrokerMsg(`✅ Broker link: ${data.brokerLink} — share it, no login needed.`); load(); } else setBrokerMsg(data.error ?? "Failed");
  }

  async function fetchCarrier(fmt: string) {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    const res = await fetch(`/api/shopify/decisions/${id}/carrier?format=${fmt}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setCarrierJson(data.edi);
  }

  useEffect(() => { load(); autoTour(); }, [id]);
  useEffect(() => { if (d) fetchCarrier(carrierFmt); }, [d, carrierFmt]);

  function download(href: string) {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    // Use fetch + blob to keep auth header
    const url = href.includes("?") ? `${href}&auth=1` : href;
    // direct nav with token header not possible — fetch blob
    fetch(href, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
      if (!r.ok) { setMsg("Download failed"); return; }
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = u; a.download = href.includes("packing") ? `packing-${id}.pdf` : href.includes("carrier") ? `carrier-${carrierFmt}-${id}.json` : `invoice-${id}.pdf`; a.click(); URL.revokeObjectURL(u);
    });
  }

  if (!d) return <div className="dashboard"><Sidebar /><main className="main"><p className="muted">{msg || "Loading decision..."}</p><Link href="/shopify">← Back to Shopify ClearShip</Link></main></div>;

  const laneLabel = d.auditTrail.landedCost?.laneLabel ?? d.lane;
  const landed = d.auditTrail.landedCost;

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/shopify" style={{ fontSize: 13 }}>← Back to your orders</Link>
          <TourButton tourId="decision" label="Tour this page" />
        </div>
        <h2 style={{ marginTop: 10 }}>{d.shopifyOrderNumber ?? `#${d.shopifyOrderId?.slice(0, 6)}`} — {d.output.buyer_country ?? d.lane.replace("-", " → ")} <span style={{ fontSize: 13, fontWeight: 400, padding: "4px 10px", borderRadius: 12, background: d.status === "ready" ? "#dcfce7" : d.status === "critical" ? "#fee2e2" : "#fef3c7", color: d.status === "ready" ? "#166534" : d.status === "critical" ? "#991b1b" : "#92400e" }}>{d.status === "ready" ? "Ready to ship" : d.status === "critical" ? "Fix needed" : "Needs quick check"} · {d.confidence}%</span></h2>
        <p className="muted" style={{ fontSize: 12 }}>Lane {laneLabel} · {new Date(d.createdAt).toLocaleString()} · {d.output.items?.length ?? 0} items · {d.output.total_value ?? ""} {d.output.currency ?? ""}</p>

        <section id="tour-stepper" className="panel" style={{ padding: 14, marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px" }}>Where is this order? (easy step tracker)</h4>
          <Stepper status={d.status} approvalStatus={d.approvalStatus ?? "pending"} brokerStatus={d.brokerStatus ?? "not_required"} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {d.approvalStatus !== "approved" ? <button className="button" style={{ background: "var(--green)", color: "white" }} onClick={() => act("approve")}>✅ Approve — it’s good</button> : <span style={{ color: "var(--green)", fontSize: 13 }}>✅ Approved by {d.approvedBy ?? "team"}</span>}
            {d.approvalStatus !== "rejected" ? <button className="button" onClick={() => act("reject")}>Ask for fix</button> : <button className="button" onClick={() => act("reset")}>Undo</button>}
            {d.brokerToken ? <a href={`/broker/view/${d.brokerToken}`} target="_blank" className="button" style={{ textDecoration: "none" }}>Open broker link →</a> : null}
          </div>
          {msg ? <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>{msg}</p> : null}
        </section>

        <section id="tour-print" className="panel" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>Print / send:</strong>
          <button className="button" onClick={() => download(`/api/shopify/decisions/${id}/pdf?type=commercial_invoice`)}>📄 Invoice PDF</button>
          <button className="button" onClick={() => download(`/api/shopify/decisions/${id}/pdf?type=packing_list`)}>📦 Packing List PDF</button>
          <select className="input" value={carrierFmt} onChange={(e) => setCarrierFmt(e.target.value)} style={{ width: 150 }}>
            <option value="generic">Carrier: Generic</option>
            <option value="easyship">Carrier: Easyship</option>
            <option value="dhl">Carrier: DHL Express</option>
            <option value="ups">Carrier: UPS</option>
          </select>
          <button className="button" onClick={() => download(`/api/shopify/decisions/${id}/carrier?format=${carrierFmt}&download=1`)}>🔌 Carrier JSON</button>
          <span className="muted" style={{ fontSize: 11 }}>1 click — no fields to fill.</span>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <section className="panel" style={{ padding: 16 }}>
            <h3>HS recommendations — confidence & review flags</h3>
            <table><thead><tr><th>#</th><th>Description</th><th>HS</th><th>Source</th><th>Review</th></tr></thead>
              <tbody>{d.hsRecommendations.map((h) => <tr key={h.line}><td>{h.line}</td><td>{h.description}</td><td style={{ color: h.hs_status !== "valid" ? "var(--red)" : undefined }}>{h.hs_code ?? "missing"}</td><td>{h.source}</td><td>{h.needsReview ? <span style={{ color: "var(--red)" }}>human review</span> : <span style={{ color: "var(--green)" }}>ok</span>}</td></tr>)}</tbody></table>
          </section>
          <section className="panel" style={{ padding: 16 }}>
            <h3>Landed cost (preflight)</h3>
            {landed ? (<><p><strong>{landed.currency} {landed.invoiceValue}</strong> → duty {landed.estimatedDuty} + tax {landed.estimatedTax} = <strong>{landed.estimatedLandedCost}</strong></p><ul>{landed.assumptions.map((a) => <li key={a} className="muted" style={{ fontSize: 12 }}>{a}</li>)}</ul></>) : <p className="muted">No estimate</p>}
            <h4 style={{ marginTop: 12 }}>Declared value consistency</h4>
            <p className="muted" style={{ fontSize: 12 }}>Invoice {d.output.total_value ?? "-"} {d.output.currency ?? ""} · {d.output.items?.length ?? 0} lines · Incoterms {d.output.incoterms ?? "-"}</p>
          </section>
        </div>

        <section id="tour-attention" className="panel" style={{ padding: 16, marginBottom: 16 }}>
          <h3>⚠️ What needs your attention (plain English)</h3>
          {d.flags.length === 0 && (d.auditTrail.restrictedHits?.length ?? 0) === 0 ? <p style={{ color: "var(--green)" }}>✅ Nothing flagged — this order looks good to ship. Just approve and print.</p> : null}
          {(d.auditTrail.restrictedHits ?? []).map((h) => (
            <div key={h.title} style={{ borderLeft: `3px solid ${h.severity === "critical" ? "var(--red)" : h.severity === "warning" ? "orange" : "var(--accent)"}`, padding: "10px 12px", marginBottom: 8, background: "#fffbeb", borderRadius: 6 }}>
              <strong style={{ fontSize: 13 }}>⚠️ {h.title}</strong> <span style={{ fontSize: 11, background: h.severity === "critical" ? "#fee2e2" : "#fef3c7", padding: "2px 6px", borderRadius: 8 }}>{h.severity === "critical" ? "Fix before ship" : "Check"}</span>
              <p style={{ fontSize: 12, margin: "6px 0 2px" }}>{h.body}</p>
              {h.sourceUrl ? <a href={h.sourceUrl} target="_blank" style={{ fontSize: 11 }}>Why? Learn more →</a> : null}
            </div>
          ))}
          {d.flags.slice(0, 6).map((f, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${f.severity === "critical" || f.severity === "error" ? "var(--red)" : f.severity === "warning" ? "orange" : "#e5e7eb"}`, padding: "8px 12px", marginBottom: 8, background: f.severity !== "info" ? "#fff" : "#f8fafc", borderRadius: 6 }}>
              <strong style={{ fontSize: 12 }}>{f.severity === "critical" || f.severity === "error" ? "🔴" : f.severity === "warning" ? "🟡" : "ℹ️"} {f.title}</strong>
              <p style={{ fontSize: 12, margin: "4px 0" }}><strong>Fix:</strong> {f.fix}</p>
            </div>
          ))}
          {d.flags.length > 6 ? <p className="muted" style={{ fontSize: 11 }}>{d.flags.length - 6} more checks passed or info — see full list below.</p> : null}
        </section>

        <section id="tour-broker" className="panel" style={{ padding: 16, marginBottom: 16, background: "#f8fafc" }}>
          <h3 style={{ margin: "0 0 8px" }}>Need a customs broker? (1 field)</h3>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Brokers open the link without an account. Great for batteries, cosmetics, supplements.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="input" placeholder="broker@email.com" value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} style={{ flex: 1 }} />
            <button className="button" onClick={inviteBroker}>Create broker link →</button>
          </div>
          {brokerMsg ? <p style={{ fontSize: 12, marginTop: 8, color: "var(--green)" }}>{brokerMsg}</p> : null}
          {d.brokerEmail ? <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Current: {d.brokerEmail} · {d.brokerStatus}</p> : null}
        </section>

        <section id="tour-hs" className="panel" style={{ padding: 16, marginBottom: 16 }}>
          <h3>📋 HS code — what we guessed and why</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>We look at your product name + past SKU memory + Interfaze AI. <strong>Red = human must double-check.</strong></p>
          <table><thead><tr><th>Item</th><th>HS</th><th>How we got it</th><th></th></tr></thead>
            <tbody>{d.hsRecommendations.map((h) => <tr key={h.line}><td style={{ fontSize: 12 }}>{h.description}</td><td style={{ fontFamily: "monospace", fontSize: 12, color: h.hs_status !== "valid" ? "var(--red)" : undefined }}>{h.hs_code ?? "missing"}</td><td style={{ fontSize: 11 }}>{h.source === "product_memory" ? "From your SKU memory" : h.source === "interfaze_ai" ? "From AI + rules" : "Missing"}</td><td>{h.needsReview ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 8, fontSize: 11 }}>Check me</span> : <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 8, fontSize: 11 }}>Looks ok</span>}</td></tr>)}</tbody></table>
        </section>

        <details className="panel" style={{ padding: 16, marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>See full technical audit (for curious / compliance vault)</summary>
          <p className="muted" style={{ fontSize: 11 }}>Every decision is saved for 7 years: rule IDs, steps, model, carrier file. Auditors love this.</p>
          <table><thead><tr><th>Severity</th><th>Field</th><th>Title</th><th>Fix</th></tr></thead>
            <tbody>{d.flags.map((f, i) => <tr key={i}><td><span style={{ color: f.severity === "critical" || f.severity === "error" ? "var(--red)" : f.severity === "warning" ? "orange" : "var(--accent)", fontSize: 11 }}>{f.severity}</span></td><td style={{ fontFamily: "monospace", fontSize: 10 }}>{f.field}</td><td style={{ fontSize: 11 }}>{f.title} {f.link ? <a href={f.link} target="_blank" style={{ fontSize: 10 }}>link</a> : null}</td><td style={{ fontSize: 11 }}>{f.fix}</td></tr>)}</tbody></table>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Steps: {(d.auditTrail.steps ?? []).map((s) => `${s.name}(${s.status})`).join(" → ") || "—"} · passed: {(d.auditTrail.passingChecks ?? []).join(", ") || "—"}</p>
          <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 6, fontSize: 10, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(d.auditTrail, null, 2)}</pre>
        </details>

        <section className="panel" style={{ padding: 16 }}>
          <h3>Carrier file — already formatted ({carrierFmt})</h3>
          <p className="muted" style={{ fontSize: 12 }}>No typing — download and upload to Easyship/DHL. Has HS, origin, value, VAT mode, battery flag.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select className="input" value={carrierFmt} onChange={(e) => setCarrierFmt(e.target.value)} style={{ width: 160 }}><option value="generic">Generic</option><option value="easyship">Easyship</option><option value="dhl">DHL Express</option><option value="ups">UPS</option></select>
            <button className="button" onClick={() => download(`/api/shopify/decisions/${id}/carrier?format=${carrierFmt}&download=1`)}>Download JSON</button>
          </div>
          <details><summary style={{ cursor: "pointer", fontSize: 12 }}>Preview JSON</summary><pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 11, maxHeight: 300 }}>{JSON.stringify(carrierJson ?? d.carrierPayload ?? {}, null, 2)}</pre></details>
        </section>
      </main>
    </div>
  );
}
