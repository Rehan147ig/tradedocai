"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Sidebar() {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    fetch("/api/alerts?unread=1", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => setUnreadAlerts(data.unreadCount ?? 0))
      .catch(() => setUnreadAlerts(0));
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => setPlan(data.user?.plan ?? "free"))
      .catch(() => setPlan("free"));
  }, []);

  const isBusiness = plan === "business" || plan === "broker";

  return (
    <aside className="sidebar">
      <div className="brand" style={{ marginBottom: 24 }}>
        TradeDocAI
      </div>
      <Link className="sidebar-primary" href="/check">Check Shipment</Link>
      <Link href="/cross-check">Cross-Check Documents</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/storage">Document Storage</Link>
      <Link href="/upload">Upload</Link>
      <Link href="/bulk">Bulk Check</Link>
      <Link href="/products">SKU Memory</Link>
      <Link className="alert-link" href="/alerts">Alerts {unreadAlerts > 0 ? <span className="alert-dot">{unreadAlerts}</span> : null}</Link>
      <Link href="/broker">Broker Review</Link>
      <Link href="/settings">Settings</Link>
      {!isBusiness ? <Link className="sidebar-upgrade" href="/pricing">Upgrade</Link> : null}
    </aside>
  );
}
