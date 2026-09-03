"use client";

export function Stepper({ status, approvalStatus, brokerStatus }: { status: string; approvalStatus: string; brokerStatus: string }) {
  const steps = [
    { key: "detected", label: "Order detected", done: true, hint: "Shopify → ClearShip" },
    { key: "checked", label: "AI checked", done: status !== "processing", hint: status === "ready" ? "Ready" : status === "critical" ? "Critical — fix" : "Needs review" },
    { key: "approved", label: "Team approval", done: approvalStatus === "approved", active: approvalStatus === "pending" && status !== "critical", hint: approvalStatus === "approved" ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Click Approve" },
    { key: "broker", label: "Broker", done: brokerStatus === "approved" || brokerStatus === "completed", active: brokerStatus === "requested", hint: brokerStatus === "not_required" ? "Not needed" : brokerStatus },
    { key: "ready", label: "Ready to ship", done: status === "ready" && approvalStatus === "approved", hint: status === "ready" ? "Print docs" : "Fix flags" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", padding: "10px 0" }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: s.done ? "var(--green, #16a34a)" : s.active ? "var(--accent, #2563eb)" : "#e5e7eb", color: s.done || s.active ? "white" : "#6b7280" }}>{s.done ? "✓" : i + 1}</div>
          <div style={{ minWidth: 90 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div><div className="muted" style={{ fontSize: 11 }}>{s.hint}</div></div>
          {i < steps.length - 1 ? <div style={{ width: 24, height: 2, background: steps[i + 1].done ? "var(--green, #16a34a)" : "#e5e7eb", margin: "0 4px" }} /> : null}
        </div>
      ))}
    </div>
  );
}
