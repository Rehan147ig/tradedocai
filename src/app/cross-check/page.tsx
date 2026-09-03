"use client";

import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UpgradeModal } from "@/components/UpgradeModal";

type Result = {
  field: string;
  doc1Value: string;
  doc2Value: string;
  doc1Type: string;
  doc2Type: string;
  status: string;
  severity: string;
};

export default function CrossCheckPage() {
  const [files, setFiles] = useState<Record<string, File | null>>({ invoice: null, packing_list: null, bol: null });
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgrade, setUpgrade] = useState<{ feature: string; requiredPlan: string; plan?: string; limit?: number } | null>(null);

  const uploadedCount = Object.values(files).filter(Boolean).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    const body = new FormData();
    for (const [type, file] of Object.entries(files)) {
      if (file) body.append(type, file);
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/documents/cross-check", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      if (data.error === "PLAN_LIMIT_REACHED" || data.error === "SKU_LIMIT_REACHED" || data.error === "FEATURE_NOT_IN_PLAN") {
        setUpgrade({ feature: data.error, requiredPlan: data.requiredPlan ?? "pro", plan: data.plan, limit: data.limit });
        return;
      }
      setError(data.error ?? "Could not compare documents.");
      return;
    }
    setResults(data.checks);
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        {upgrade ? <UpgradeModal feature={upgrade.feature} requiredPlan={upgrade.requiredPlan} plan={upgrade.plan} limit={upgrade.limit} onClose={() => setUpgrade(null)} /> : null}
        <h2>Cross-check documents</h2>
        <p className="muted">Upload at least two documents. TradeDocAI checks whether names, weights, packages, HS codes, ports, origin, and values agree.</p>
        <form onSubmit={submit}>
          <div className="cross-upload-grid">
            <UploadBox title="Commercial Invoice" file={files.invoice} onFile={(file) => setFiles({ ...files, invoice: file })} />
            <UploadBox title="Packing List" file={files.packing_list} onFile={(file) => setFiles({ ...files, packing_list: file })} />
            <UploadBox title="Bill of Lading" file={files.bol} onFile={(file) => setFiles({ ...files, bol: file })} />
          </div>
          {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
          {uploadedCount >= 2 ? <button className="button" disabled={loading}>{loading ? "Checking consistency..." : "Check consistency"}</button> : null}
        </form>

        {results.length ? (
          <section className="panel" style={{ marginTop: 22, padding: 22 }}>
            <h3>Consistency results</h3>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr><th>Field</th><th>Documents</th><th>Values</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={`${result.field}-${index}`}>
                      <td><code>{result.field}</code></td>
                      <td>{result.doc1Type} vs {result.doc2Type}</td>
                      <td>{result.doc1Value || "Missing"} / {result.doc2Value || "Missing"}</td>
                      <td><span className={`status ${result.status === "match" ? "ready" : result.severity === "critical" ? "critical" : "needs_review"}`}>{result.status.replaceAll("_", " ")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function UploadBox({ title, file, onFile }: { title: string; file: File | null; onFile: (file: File | null) => void }) {
  return (
    <label className="upload-zone compact-upload">
      <input accept=".pdf,application/pdf" hidden onChange={(event) => onFile(event.target.files?.[0] ?? null)} type="file" />
      <span><strong>{title}</strong><br /><span className="muted">{file ? file.name : "Choose PDF"}</span></span>
    </label>
  );
}
