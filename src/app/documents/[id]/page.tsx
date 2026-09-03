"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type Flag = {
  severity: string;
  title: string;
  field: string;
  fix: string;
  source?: string;
  link?: string;
};

type LineItem = {
  description?: string | null;
  hs_code?: string | null;
  country_of_origin?: string | null;
};

type Detail = {
  id: string;
  originalFilename: string;
  status: string;
  confidenceScore: number;
  processingTimeMs: number | null;
  uploadedAt: string;
  extractedData: Record<string, unknown> & {
    flags?: Flag[];
    rule_score?: number;
    rule_status?: "ready" | "review" | "high-risk";
    passing_checks?: string[];
    items?: LineItem[];
    landed_cost?: {
      laneLabel: string;
      currency: string;
      invoiceValue: number;
      estimatedDuty: number;
      estimatedTax: number;
      estimatedLandedCost: number;
      assumptions: string[];
    };
  };
};

type Product = {
  sku: string;
  name: string;
  hsCode: string;
  countryOfOrigin: string;
};

function normalizeCode(value?: string | null) {
  return String(value ?? "").replace(/[.\s]/g, "").toLowerCase();
}

function normalizeText(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function isBlockingFlag(flag: Flag) {
  return flag.severity === "critical" || flag.severity === "error";
}

function statusFromReport(score: number, criticalCount: number) {
  if (score < 50 || criticalCount >= 3) return { className: "critical", label: "High risk - do not ship" };
  if (score < 80 || criticalCount > 0) return { className: "needs_review", label: "Needs review - fix before shipping" };
  return { className: "ready", label: "Ready to ship" };
}

function fallbackPassingChecks(detail: Detail, flags: Flag[]) {
  const flaggedFields = new Set(flags.map((flag) => flag.field));
  const data = detail.extractedData;
  const firstItem = data.items?.[0];
  const checks: Array<[string, boolean]> = [
    ["Seller name found", Boolean(data.seller_name) && !flaggedFields.has("seller_name")],
    ["Buyer name found", Boolean(data.buyer_name) && !flaggedFields.has("buyer_name")],
    ["Invoice value found", Boolean(data.total_value) && !flaggedFields.has("invoice_value")],
    ["Currency found", Boolean(data.currency) && !flaggedFields.has("currency")],
    ["HS code format looks usable", Boolean(firstItem?.hs_code) && !Array.from(flaggedFields).some((field) => field.includes("hs_code"))],
    ["Country of origin found", Boolean(firstItem?.country_of_origin) && !Array.from(flaggedFields).some((field) => field.includes("country_of_origin"))],
  ];
  return checks.filter(([, passed]) => passed).map(([label]) => label);
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState("");
  const [brokerEmail, setBrokerEmail] = useState("");
  const [brokerMessage, setBrokerMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [skuPromptDismissed, setSkuPromptDismissed] = useState(false);
  const [skuSaveMessage, setSkuSaveMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }

    const load = () => {
      fetch(`/api/documents/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "Could not load document");
          setDetail(payload.document);
        })
        .catch((err) => setError(err.message));
    };

    load();
    fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (response.ok) setProducts(payload.products ?? []);
      })
      .catch(() => setProducts([]));
    const interval = setInterval(() => {
      if (!detail || detail.status === "processing") load();
    }, 2500);
    return () => clearInterval(interval);
  }, [params.id, detail?.status]);

  const report = useMemo(() => {
    if (!detail) return null;
    const flags = detail.extractedData.flags ?? [];
    const criticalFlags = flags.filter(isBlockingFlag);
    const warningFlags = flags.filter((flag) => flag.severity === "warning");
    const adcvdFlag = flags.find((flag) => flag.source === "adcvd" || /antidumping|countervailing/i.test(`${flag.title} ${flag.fix}`));
    const score = typeof detail.extractedData.rule_score === "number" ? detail.extractedData.rule_score : detail.confidenceScore;
    const status = statusFromReport(score, criticalFlags.length);
    const passingChecks = detail.extractedData.passing_checks?.length
      ? detail.extractedData.passing_checks
      : fallbackPassingChecks(detail, flags);
    const firstItem = detail.extractedData.items?.[0];
    const productName = firstItem?.description || normalizeText(String(detail.extractedData.document_type ?? "")) || "this product";
    const hsCode = firstItem?.hs_code ?? "";
    const origin = firstItem?.country_of_origin ?? "";
    const productExists = products.some((product) => (
      normalizeCode(product.hsCode) === normalizeCode(hsCode)
      && normalizeText(product.countryOfOrigin) === normalizeText(origin)
      && (normalizeText(product.name) === normalizeText(productName) || normalizeText(product.sku) === normalizeText(productName))
    ));
    return { flags, criticalFlags, warningFlags, adcvdFlag, score, status, passingChecks, firstItem, productName, hsCode, origin, productExists };
  }, [detail, products]);

  async function loadGenerated(type: string) {
    const token = localStorage.getItem("tradedocai_token");
    const response = await fetch(`/api/documents/${params.id}/generate?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    setGenerated(text);
  }

  async function requestBrokerReview() {
    const token = localStorage.getItem("tradedocai_token");
    const response = await fetch("/api/broker-reviews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: params.id,
        brokerEmail,
        note: "Please review this customs preflight report and confirm the filing risk.",
      }),
    });
    const data = await response.json();
    setBrokerMessage(response.ok ? "Broker review request saved." : data.error ?? "Could not request review.");
  }

  async function saveSkuMemory() {
    if (!report) return;
    const token = localStorage.getItem("tradedocai_token");
    const cleanHs = normalizeCode(report.hsCode);
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sku: `${cleanHs || "sku"}-${normalizeText(report.origin).replace(/\s+/g, "-") || "origin"}`.slice(0, 80),
        name: report.productName,
        customsDescription: report.productName.length >= 8 ? report.productName : `${report.productName} customs product`,
        hsCode: cleanHs,
        countryOfOrigin: report.origin,
        material: null,
        defaultLane: null,
        confidenceNote: `Saved from document ${detail?.originalFilename ?? ""}`,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSkuSaveMessage(data.error ?? "Could not save this SKU.");
      return;
    }
    setProducts((current) => [data.product, ...current]);
    setSkuSaveMessage("Saved to SKU memory.");
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <Link href="/dashboard">Back to dashboard</Link>
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        {!detail ? <p className="muted">Loading document...</p> : null}
        {detail ? (
          <>
            <h2>{detail.originalFilename}</h2>
            {report ? (
              <div className={`status report-status ${report.status.className}`}>
                {report.status.label}
              </div>
            ) : null}
            <div className="two-col">
              <section className="panel" style={{ padding: 22 }}>
                <h3>Summary</h3>
                <p className="muted">Rule score</p>
                <h3>{report?.score ?? detail.confidenceScore}/100</h3>
                <p className="muted">Confidence</p>
                <div className="progress">
                  <span style={{ width: `${detail.confidenceScore}%` }} />
                </div>
                <p>{detail.confidenceScore}%</p>
                <p className="muted">Processing time</p>
                <p>{detail.processingTimeMs ? `${detail.processingTimeMs} ms` : "Processing"}</p>
                {detail.extractedData.landed_cost ? (
                  <>
                    <p className="muted">Estimated landed cost</p>
                    <h3>
                      {detail.extractedData.landed_cost.currency} {detail.extractedData.landed_cost.estimatedLandedCost}
                    </h3>
                    <p className="muted">{detail.extractedData.landed_cost.laneLabel}</p>
                  </>
                ) : null}
              </section>
              <section className="panel" style={{ padding: 22 }}>
                {report?.adcvdFlag ? (
                  <div className="adcvd-banner">
                    <strong>This product may carry antidumping / countervailing duties of 25-200%+ extra.</strong>
                    <p>Verify at cbp.gov before shipping. <a href={report.adcvdFlag.link ?? "https://www.cbp.gov/trade/remedies/adcvd"} target="_blank" rel="noreferrer">Open CBP lookup</a></p>
                  </div>
                ) : null}
                <ReportZone tone="red" title="Will stop your shipment" flags={report?.criticalFlags ?? []} emptyText="No blocking issues found." />
                <ReportZone tone="amber" title="May cause delays" flags={report?.warningFlags ?? []} emptyText="No delay warnings found." />
                <section className="report-zone green-zone">
                  <h3>Looks good</h3>
                  <ul>
                    {(report?.passingChecks ?? []).slice(0, 6).map((check) => <li key={check}>{check}</li>)}
                    {(report?.passingChecks ?? []).length === 0 ? <li>No passed checks to show yet.</li> : null}
                  </ul>
                </section>
              </section>
            </div>
            {report && detail.status !== "processing" && report.hsCode && report.origin && !report.productExists && !skuPromptDismissed ? (
              <section className="sku-save-card">
                <div>
                  <h3>Save to SKU memory?</h3>
                  <p className="muted">Save {report.productName} for next time? HS {report.hsCode} · {report.origin}</p>
                  {skuSaveMessage ? <p className="muted">{skuSaveMessage}</p> : null}
                </div>
                <div className="actions">
                  <button className="button" onClick={saveSkuMemory}>Save</button>
                  <button className="button secondary" onClick={() => setSkuPromptDismissed(true)}>Dismiss</button>
                </div>
              </section>
            ) : null}
            <section className="panel" style={{ marginTop: 18, padding: 22 }}>
              <h3>Generated outputs</h3>
              <div className="actions">
                <button className="button secondary" onClick={() => loadGenerated("broker-summary")}>Broker summary</button>
                <button className="button secondary" onClick={() => loadGenerated("correction-checklist")}>Correction checklist</button>
                <button className="button secondary" onClick={() => loadGenerated("customer-duty-notice")}>Customer duty notice</button>
              </div>
              {generated ? <pre className="json">{generated}</pre> : null}
            </section>

            <section className="panel" style={{ marginTop: 18, padding: 22 }}>
              <h3>Send to broker</h3>
              <div className="broker-inline">
                <input className="input" value={brokerEmail} onChange={(event) => setBrokerEmail(event.target.value)} placeholder="broker@example.com" />
                <button className="button" onClick={requestBrokerReview}>Request review</button>
              </div>
              {brokerMessage ? <p className="muted">{brokerMessage}</p> : null}
            </section>

            <section className="panel" style={{ marginTop: 18, padding: 22 }}>
              <h3>Raw extraction</h3>
              <pre className="json">{JSON.stringify(detail.extractedData, null, 2)}</pre>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function ReportZone({ tone, title, flags, emptyText }: { tone: "red" | "amber"; title: string; flags: Flag[]; emptyText: string }) {
  return (
    <section className={`report-zone ${tone}-zone`}>
      <h3>{title}</h3>
      {flags.length ? (
        <div className="flag-list">
          {flags.map((flag, index) => (
            <div className={`flag ${flag.severity}`} key={`${flag.field}-${index}`}>
              <code>{flag.field}</code>
              {flag.source === "adcvd" ? <span className="adcvd-badge">AD/CVD</span> : null}
              <strong>{flag.title}</strong>
              <p className="muted">Fix: {flag.fix}</p>
            </div>
          ))}
        </div>
      ) : <p className="muted">{emptyText}</p>}
    </section>
  );
}
