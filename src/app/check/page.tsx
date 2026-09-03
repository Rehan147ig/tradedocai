"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UpgradeModal } from "@/components/UpgradeModal";
import { TourButton, useAutoTour } from "@/components/Tour";

const lanes = [
  ["india-uk", "India to UK"],
  ["india-us", "India to US"],
  ["india-eu", "India to EU"],
  ["uk-eu", "UK to EU"],
  ["eu-uk", "EU to UK"],
  ["global", "Other / not sure"],
];

type Mode = "single" | "bulk";

export default function CheckPage() {
  const router = useRouter();
  const [lane, setLane] = useState("india-uk");
  const [mode, setMode] = useState<Mode>("single");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepText, setStepText] = useState("");
  const [upgrade, setUpgrade] = useState<{ feature: string; requiredPlan: string; plan?: string; limit?: number } | null>(null);
  const autoTour = useAutoTour("check", 1200);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (!files.length) return;

    setLoading(true);
    setError("");
    const createdIds: string[] = [];
    for (const file of files) {
      setStepText(`Checking ${file.name}`);
      const body = new FormData();
      body.append("file", file);
      body.append("lane", lane);
      body.append("mode", mode);
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === "PLAN_LIMIT_REACHED" || data.error === "SKU_LIMIT_REACHED" || data.error === "FEATURE_NOT_IN_PLAN") {
          setUpgrade({ feature: data.error, requiredPlan: data.requiredPlan ?? "pro", plan: data.plan, limit: data.limit });
          setLoading(false);
          return;
        }
        setError(data.error ?? `Could not check ${file.name}`);
        setLoading(false);
        return;
      }
      createdIds.push(data.documentId);
    }
    setLoading(false);
    if (mode === "single" && createdIds[0]) {
      router.push(`/documents/${createdIds[0]}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main check-flow">
        {upgrade ? <UpgradeModal feature={upgrade.feature} requiredPlan={upgrade.requiredPlan} plan={upgrade.plan} limit={upgrade.limit} onClose={() => setUpgrade(null)} /> : null}
        <div id="tour-check-hero" className="flow-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div className="eyebrow">One simple workflow</div>
            <h2>Check a shipment before you send it.</h2>
            <p className="muted">Choose the route, upload invoice PDFs, then TradeDocAI checks documents, storage, SKU memory, landed-cost risk, and broker-ready outputs in one run.</p>
          </div>
          <TourButton tourId="check" label="How it works" />
        </div>

        <form className="flow-grid" onSubmit={submit}>
          <section className="flow-step">
            <span className="step-number">1</span>
            <h3>Shipment route</h3>
            <div className="choice-grid">
              {lanes.map(([value, label]) => (
                <button className={lane === value ? "choice active" : "choice"} key={value} onClick={() => setLane(value)} type="button">
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="flow-step">
            <span className="step-number">2</span>
            <h3>Check type</h3>
            <div className="choice-grid two">
              <button className={mode === "single" ? "choice active" : "choice"} onClick={() => setMode("single")} type="button">
                Single invoice
              </button>
              <button className={mode === "bulk" ? "choice active" : "choice"} onClick={() => setMode("bulk")} type="button">
                Batch upload
              </button>
            </div>
          </section>

          <section id="tour-check-upload" className="flow-step flow-upload">
            <span className="step-number">3</span>
            <h3>Upload invoice</h3>
            <label className="upload-zone">
              <input
                accept=".pdf,application/pdf"
                hidden
                multiple={mode === "bulk"}
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                type="file"
              />
              <span>
                <strong>{files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Choose PDF invoice"}</strong>
                <br />
                <span className="muted">Stored with upload timestamp, size, status, and retention date.</span>
              </span>
            </label>
            {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
            {stepText ? <p className="muted">{stepText}</p> : null}
            <button className="button" disabled={!files.length || loading}>
              {loading ? "Checking shipment..." : "Run customs preflight"}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}
