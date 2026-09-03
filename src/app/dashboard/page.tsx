"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes } from "@/lib/plans";

type DocumentRow = {
  id: string;
  originalFilename: string;
  documentType: string;
  status: string;
  confidenceScore: number;
  uploadedAt: string;
  expiresAt: string;
  fileSizeBytes: number;
};

type DashboardData = {
  user: { plan: string; documentsUsedThisMonth: number };
  storage: { totalBytesUsed: number; storageLimitBytes: number; documentCountThisMonth: number };
  limits: { docsPerMonth: number; storageBytes: number };
  documents: DocumentRow[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    fetch("/api/documents", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load dashboard");
        setData(payload);
      })
      .catch((err) => setError(err.message));
    fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (response.ok) {
          setUnreadAlerts((payload.alerts ?? []).filter((alert: { isRead: boolean }) => !alert.isRead).length);
        }
      })
      .catch(() => setUnreadAlerts(0));
  }, []);

  const counts = useMemo(() => {
    const docs = data?.documents ?? [];
    return {
      ready: docs.filter((doc) => doc.status === "ready").length,
      review: docs.filter((doc) => doc.status === "needs_review").length,
      critical: docs.filter((doc) => doc.status === "critical").length,
    };
  }, [data]);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Dashboard</h2>
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        {!data ? <p className="muted">Loading dashboard...</p> : null}
        {data ? (
          <>
            <div className="panel dashboard-cta">
              <div>
                <div className="eyebrow">Main workflow</div>
                <h2>Check a shipment</h2>
                <p className="muted">Route, invoice upload, SKU memory, storage, landed-cost risk, and broker outputs in one guided flow.</p>
              </div>
              <Link className="button" href="/check">Start preflight</Link>
            </div>

            <div className="metrics">
              <div className="metric">
                <span className="muted">Docs this month</span>
                <strong>
                  {data.user.documentsUsedThisMonth}/{data.limits.docsPerMonth}
                </strong>
              </div>
              <div className="metric">
                <span className="muted">Ready</span>
                <strong>{counts.ready}</strong>
              </div>
              <div className="metric">
                <span className="muted">Needs review</span>
                <strong>{counts.review}</strong>
              </div>
              <div className="metric">
                <span className="muted">Critical</span>
                <strong>{counts.critical}</strong>
              </div>
              <div className="metric">
                <span className="muted">Alerts</span>
                <strong>{unreadAlerts}</strong>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 22 }}>
              <h3>Storage</h3>
              <div className="progress">
                <span style={{ width: `${Math.min(100, (data.storage.totalBytesUsed / data.limits.storageBytes) * 100)}%` }} />
              </div>
              <p className="muted">
                {formatBytes(data.storage.totalBytesUsed)} of {formatBytes(data.limits.storageBytes)} used
              </p>
            </div>

            <div className="grid-3" style={{ margin: "0 0 22px" }}>
              <div className="card">
                <h3>SKU Memory</h3>
                <p className="muted">Save HS codes and origin once, then reuse them across future invoices.</p>
                <Link href="/products">Manage products</Link>
              </div>
              <div className="card">
                <h3>Document Storage</h3>
                <p className="muted">Access old invoices by timestamp, status, size, and expiry date.</p>
                <Link href="/storage">Open storage</Link>
              </div>
              <div className="card">
                <h3>Cross-check documents</h3>
                <p className="muted">Compare invoice, packing list, and bill of lading before a customs hold happens.</p>
                <Link href="/cross-check">Compare documents</Link>
              </div>
              <div className="card">
                <h3>Bulk Check</h3>
                <p className="muted">Run a dispatch batch before sending files to DHL, FedEx, or a broker.</p>
                <Link href="/bulk">Check a batch</Link>
              </div>
              <div className="card">
                <h3>Broker Review</h3>
                <p className="muted">Queue risky documents for broker review and keep the audit trail.</p>
                <Link href="/broker">View reviews</Link>
              </div>
            </div>

            {data.documents.length === 0 ? (
              <div className="card">
                <h3>No documents yet</h3>
                <p className="muted">Upload a commercial invoice PDF and TradeDocAI will generate the first compliance report.</p>
                <Link className="button" href="/upload">
                  Upload document
                </Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Confidence</th>
                      <th>Date</th>
                      <th>Stored until</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.originalFilename}</td>
                        <td>{doc.documentType}</td>
                        <td>
                          <StatusBadge status={doc.status} />
                        </td>
                        <td>{doc.confidenceScore}%</td>
                        <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                        <td>{new Date(doc.expiresAt).toLocaleDateString()}</td>
                        <td>
                          <Link href={`/documents/${doc.id}`}>View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
