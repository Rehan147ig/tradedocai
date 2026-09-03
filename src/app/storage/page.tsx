"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes } from "@/lib/plans";

type StorageDocument = {
  id: string;
  originalFilename: string;
  status: string;
  documentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  expiresAt: string;
  confidenceScore: number;
};

type StorageData = {
  storage: { totalBytesUsed: number; storageLimitBytes: number; documentCountThisMonth: number };
  limits: { storageBytes: number; docsPerMonth: number; retentionDays: number };
  documents: StorageDocument[];
};

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    fetch("/api/documents", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load storage");
        setData(payload);
      })
      .catch((err) => setError(err.message));
  }, []);

  const byMonth = useMemo(() => {
    const groups = new Map<string, StorageDocument[]>();
    for (const doc of data?.documents ?? []) {
      const date = new Date(doc.uploadedAt);
      const key = date.toLocaleString(undefined, { month: "long", year: "numeric" });
      groups.set(key, [...(groups.get(key) ?? []), doc]);
    }
    return Array.from(groups.entries());
  }, [data]);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Document Storage</h2>
        <p className="muted">Every invoice is stored with upload timestamp, file size, status, and expiry date based on your plan.</p>
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        {!data ? <p className="muted">Loading storage...</p> : null}
        {data ? (
          <>
            <div className="metrics">
              <div className="metric">
                <span className="muted">Storage used</span>
                <strong>{formatBytes(data.storage.totalBytesUsed)}</strong>
              </div>
              <div className="metric">
                <span className="muted">Storage limit</span>
                <strong>{formatBytes(data.limits.storageBytes)}</strong>
              </div>
              <div className="metric">
                <span className="muted">Docs stored</span>
                <strong>{data.documents.length}</strong>
              </div>
              <div className="metric">
                <span className="muted">Retention</span>
                <strong>{data.limits.retentionDays}d</strong>
              </div>
            </div>

            {byMonth.map(([month, docs]) => (
              <section className="panel storage-month" key={month}>
                <h3>{month}</h3>
                <div className="table-wrap flat">
                  <table>
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Uploaded</th>
                        <th>Expires</th>
                        <th>Size</th>
                        <th>Status</th>
                        <th>Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((doc) => (
                        <tr key={doc.id}>
                          <td>{doc.originalFilename}</td>
                          <td>{new Date(doc.uploadedAt).toLocaleString()}</td>
                          <td>{new Date(doc.expiresAt).toLocaleDateString()}</td>
                          <td>{formatBytes(doc.fileSizeBytes)}</td>
                          <td><StatusBadge status={doc.status} /></td>
                          <td><Link href={`/documents/${doc.id}`}>Report</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        ) : null}
      </main>
    </div>
  );
}
