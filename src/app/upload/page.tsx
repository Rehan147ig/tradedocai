"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [lane, setLane] = useState("india-uk");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    body.append("lane", lane);
    const response = await fetch("/api/documents/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    router.push(`/documents/${data.documentId}`);
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Upload document</h2>
        <p className="muted">Use this direct upload when you already know the shipment route. For the simplest path, use Check Shipment.</p>
        <form className="panel" style={{ padding: 24 }} onSubmit={submit}>
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
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <span>
              <strong>{file ? file.name : "Drop or choose a PDF invoice"}</strong>
              <br />
              <span className="muted">{file ? `${Math.round(file.size / 1024)} KB selected` : "Maximum 20MB per document"}</span>
            </span>
          </label>
          {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
          <div className="actions">
            <button className="button" disabled={!file || loading}>
              {loading ? "Reading PDF, extracting fields, validating..." : "Analyse document"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
