"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type Alert = {
  id: string;
  hsCode: string;
  alertType: string;
  title: string;
  body: string;
  lane: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
  sku: { sku: string; name: string; hsCode: string };
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function load() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    const response = await fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    setAlerts(data.alerts ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    const token = localStorage.getItem("tradedocai_token");
    await fetch(`/api/alerts/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Tariff alerts</h2>
        <p className="muted">TradeDocAI watches saved SKUs and flags tariff, AD/CVD, and regulation changes that may affect future shipments.</p>
        <div className="alert-list">
          {alerts.map((alert) => (
            <section className={`panel alert-card ${alert.severity}`} key={alert.id}>
              <div>
                <span className={`status ${alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "needs_review" : "processing"}`}>{alert.severity}</span>
                <h3>{alert.title}</h3>
                <p>{alert.body}</p>
                <p className="muted">SKU {alert.sku?.sku ?? "Unknown"} · HS {alert.hsCode} · {alert.lane} · {new Date(alert.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="actions">
                {!alert.isRead ? <button className="button secondary" onClick={() => markRead(alert.id)}>Mark as read</button> : null}
                <Link className="button" href={`/check?sku=${alert.sku?.sku ?? ""}`}>Re-check this SKU</Link>
              </div>
            </section>
          ))}
          {!alerts.length ? <div className="card"><h3>No alerts yet</h3><p className="muted">Saved SKU alerts will appear here when a tariff or regulation needs attention.</p></div> : null}
        </div>
      </main>
    </div>
  );
}
