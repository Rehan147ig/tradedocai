"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { UpgradeModal } from "@/components/UpgradeModal";

type BulkResult = {
  filename: string;
  documentId?: string;
  status: string;
  error?: string;
};

export default function BulkPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [lane, setLane] = useState("india-uk");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [upgrade, setUpgrade] = useState<{ feature: string; requiredPlan: string; plan?: string; limit?: number } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    setRunning(true);
    const nextResults: BulkResult[] = [];
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      body.append("lane", lane);
      body.append("mode", "bulk");
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json();
      if (!response.ok && (data.error === "PLAN_LIMIT_REACHED" || data.error === "SKU_LIMIT_REACHED" || data.error === "FEATURE_NOT_IN_PLAN")) {
        setUpgrade({ feature: data.error, requiredPlan: data.requiredPlan ?? "pro", plan: data.plan, limit: data.limit });
        setRunning(false);
        return;
      }
      nextResults.push({
        filename: file.name,
        documentId: data.documentId,
        status: response.ok ? "processing" : "critical",
        error: response.ok ? undefined : data.error ?? "Upload failed",
      });
      setResults([...nextResults]);
    }
    setRunning(false);
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        {upgrade ? <UpgradeModal feature={upgrade.feature} requiredPlan={upgrade.requiredPlan} plan={upgrade.plan} limit={upgrade.limit} onClose={() => setUpgrade(null)} /> : null}
        <h2>Bulk Check</h2>
        <p className="muted">Upload multiple invoices before a dispatch batch. TradeDocAI checks them one by one and gives you a queue of reports to review.</p>

        <form className="panel" style={{ padding: 24, marginBottom: 22 }} onSubmit={submit}>
          <select className="input" value={lane} onChange={(event) => setLane(event.target.value)} style={{ marginBottom: 14 }}>
            <option value="india-uk">India to UK</option>
            <option value="india-us">India to US</option>
            <option value="india-eu">India to EU</option>
            <option value="uk-eu">UK to EU</option>
            <option value="eu-uk">EU to UK</option>
            <option value="global">Other / not sure</option>
          </select>
          <label className="upload-zone">
            <input
              accept=".pdf,application/pdf"
              hidden
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              type="file"
            />
            <span>
              <strong>{files.length ? `${files.length} files selected` : "Choose invoice PDFs"}</strong>
              <br />
              <span className="muted">Best for weekly export batches and broker prep.</span>
            </span>
          </label>
          <div className="actions">
            <button className="button" disabled={!files.length || running}>
              {running ? "Checking batch..." : "Start bulk check"}
            </button>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.filename}>
                  <td>{result.filename}</td>
                  <td><StatusBadge status={result.status} /></td>
                  <td>
                    {result.documentId ? <Link href={`/documents/${result.documentId}`}>Open report</Link> : result.error}
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td colSpan={3}>No batch results yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
