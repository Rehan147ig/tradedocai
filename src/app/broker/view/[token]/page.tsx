import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function BrokerViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await prisma.shipmentDecision.findFirst({ where: { brokerToken: token } });
  if (!d) return notFound();

  const output = JSON.parse(d.outputJson || "{}");
  const audit = JSON.parse(d.auditTrailJson || "{}");
  const flags = JSON.parse(d.flagsJson || "[]");
  const hs = JSON.parse(d.hsRecommendationsJson || "[]");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>Broker Review — {d.shopifyOrderNumber ?? d.shopifyOrderId ?? d.id.slice(0, 8)}</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>Lane {d.lane} · {d.status} · confidence {d.confidence}% · No login needed. This link is private.</p>

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Order</h3>
        <p style={{ fontSize: 13 }}>Buyer: {output.buyer_name ?? "-"} · {output.buyer_address ?? output.buyer_country ?? "-"} · Value {output.total_value ?? "-"} {output.currency ?? ""} · Incoterms {output.incoterms ?? "-"}</p>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 8 }}>
          <thead><tr style={{ background: "#0f172a", color: "white" }}><th style={{ padding: 6 }}>#</th><th style={{ padding: 6 }}>Description</th><th style={{ padding: 6 }}>HS</th><th style={{ padding: 6 }}>Origin</th><th style={{ padding: 6 }}>Qty</th></tr></thead>
          <tbody>{(output.items ?? []).map((it: { description: string; hs_code?: string | null; country_of_origin?: string | null; quantity?: string | null }, i: number) => <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}><td style={{ padding: 6 }}>{i + 1}</td><td style={{ padding: 6 }}>{it.description}</td><td style={{ padding: 6 }}>{it.hs_code ?? "missing"}</td><td style={{ padding: 6 }}>{it.country_of_origin ?? "-"}</td><td style={{ padding: 6 }}>{it.quantity ?? "-"}</td></tr>)}</tbody>
        </table>
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>What ClearShip flagged</h3>
        <ul>{(flags as Array<{ title: string; fix: string; severity: string }>).map((f, i) => <li key={i} style={{ fontSize: 12, marginBottom: 4 }}><strong>{f.severity}:</strong> {f.title} — {f.fix}</li>)}</ul>
        {(audit.restrictedHits as Array<{ title: string }> | undefined)?.length ? <><h4 style={{ fontSize: 12 }}>Restricted hits</h4><ul>{(audit.restrictedHits as Array<{ title: string; body: string }>).map((h) => <li key={h.title} style={{ fontSize: 12 }}>{h.title} — {h.body}</li>)}</ul></> : null}
      </div>

      <div style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>HS recommendations</h3>
        <ul>{(hs as Array<{ description: string; hs_code: string | null; source: string; needsReview: boolean }>).map((h) => <li key={h.description} style={{ fontSize: 12 }}>{h.description} → <strong>{h.hs_code ?? "missing"}</strong> ({h.source}) {h.needsReview ? "— needs review" : "— ok"}</li>)}</ul>
        <h4 style={{ fontSize: 12 }}>Audit trail</h4>
        <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 6, fontSize: 11, overflow: "auto" }}>{JSON.stringify({ workflow: audit.workflowId, runId: audit.runId, steps: audit.steps, carrierPayload: audit.carrierPayload }, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <form action={async () => {
          "use server";
          await prisma.shipmentDecision.update({ where: { id: d.id }, data: { brokerStatus: "approved" } as never });
        }}>
          <button style={{ background: "#16a34a", color: "white", padding: "10px 16px", borderRadius: 6, border: 0, cursor: "pointer" }}>Broker Approve</button>
        </form>
        <form action={async () => {
          "use server";
          await prisma.shipmentDecision.update({ where: { id: d.id }, data: { brokerStatus: "rejected" } as never });
        }}>
          <button style={{ background: "#dc2626", color: "white", padding: "10px 16px", borderRadius: 6, border: 0, cursor: "pointer" }}>Reject</button>
        </form>
      </div>
      <p style={{ color: "#64748b", fontSize: 11, marginTop: 16 }}>Public broker link — no TradeDocAI account needed. Owner sees status update in Shopify detail.</p>
    </div>
  );
}
