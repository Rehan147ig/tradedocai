import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { StatusBadge } from "@/components/StatusBadge";

const checks = [
  ["HS code missing", "Wireless headphones", "Add a 6-10 digit commodity code before DHL/FedEx creates the declaration."],
  ["Origin missing", "Cotton tote bag", "Country of origin is required for duty treatment and border confidence."],
  ["VAT/EORI mismatch", "EU B2B buyer", "Fix tax IDs before the shipment is pulled into manual review."],
];

const segments = [
  ["Amazon Global Selling exporters", "Check invoices before FBA/export dispatch, especially India to US/UK/EU lanes."],
  ["Shopify and WooCommerce sellers", "Avoid surprise duties, refused delivery, and bad customs descriptions."],
  ["Customs brokers and forwarders", "Review more client paperwork with a structured risk report before filing."],
];

const workflow = [
  ["1", "Choose route", "India to UK, India to US, UK to EU, or another lane."],
  ["2", "Upload invoice", "Drop a digital PDF. We store it with timestamp and retention date."],
  ["3", "Get risk report", "See missing HS codes, origin, VAT/EORI, value, and landed-cost risk."],
  ["4", "Fix or send", "Save SKU rules, generate broker summary, or send for review."],
];

export default function LandingPage() {
  return (
    <div className="shell">
      <Topbar />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Customs preflight for e-commerce exporters</div>
            <h1>Your shipment should not get stuck because of one bad invoice field.</h1>
            <p className="lead">
              TradeDocAI checks commercial invoices for HS code, origin, VAT/EORI, value, and paperwork risks before you ship to Amazon FBA, Shopify customers, or your freight forwarder.
            </p>
            <div className="actions">
              <Link className="button" href="/register">
                Check first invoice free
              </Link>
              <Link className="button secondary" href="/pricing">
                See plans
              </Link>
            </div>
            <div className="trust-row">
              <span>Built for India to US/UK/EU</span>
              <span>UK to EU</span>
              <span>EU to UK</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="TradeDocAI product preview">
            <img
              alt="E-commerce shipping desk with parcels"
              className="hero-photo"
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1100&q=80"
            />
            <div className="floating-report">
              <div className="report-head">
                <strong>Shipment risk report</strong>
                <StatusBadge status="needs_review" />
              </div>
              <div className="route-pill">India to United Kingdom</div>
              <div className="risk-meter">
                <span style={{ width: "72%" }} />
              </div>
              <p className="muted">3 issues found before dispatch</p>
            </div>
            <div className="invoice-card">
              <div className="invoice-line wide" />
              <div className="invoice-line" />
              <div className="invoice-line short" />
              <div className="invoice-table">
                <span>SKU</span>
                <span>HS</span>
                <span>Origin</span>
                <span className="bad">Missing</span>
                <span>8518.30</span>
                <span className="bad">Blank</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section container workflow-showcase">
          <div className="workflow-copy">
            <div className="eyebrow">How the tool works</div>
            <h2>One simple flow, all customs checks handled behind it.</h2>
            <p className="lead">
              Sellers should not learn customs software. They should choose the shipment route, upload the invoice, and get plain-language fixes before dispatch.
            </p>
            <div className="workflow-steps">
              {workflow.map(([number, title, body]) => (
                <div className="workflow-step-row" key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flow-browser">
            <div className="browser-bar">
              <span />
              <span />
              <span />
              <b>Check Shipment</b>
            </div>
            <div className="browser-body">
              <div className="flow-card active">
                <small>Step 1</small>
                <strong>India to UK</strong>
                <p>Lane rules selected</p>
              </div>
              <div className="flow-card">
                <small>Step 2</small>
                <strong>Invoice.pdf</strong>
                <p>Stored May 5, 2026</p>
              </div>
              <div className="flow-card warning-card">
                <small>Step 3</small>
                <strong>Needs review</strong>
                <p>HS code and origin missing</p>
              </div>
              <div className="generated-stack">
                <div>Correction checklist</div>
                <div>Broker summary</div>
                <div>Customer duty notice</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section container problem-band">
          <div>
            <div className="eyebrow">The exact problem</div>
            <h2>Customs delays usually start inside the invoice, not at the border.</h2>
          </div>
          <div className="problem-grid">
            {checks.map(([title, item, fix]) => (
              <div className="problem-card" key={title}>
                <span className="problem-icon">!</span>
                <strong>{title}</strong>
                <p>{item}</p>
                <small>{fix}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="section container product-section">
          <div className="product-copy">
            <div className="eyebrow">What users came here to solve</div>
            <h2>Upload the invoice. Get a preflight checklist before you book the shipment.</h2>
            <p className="lead">
              The report gives sellers and brokers the fields to fix: missing HS codes, weak product descriptions, blank origin, old invoice dates, mismatched values, and tax ID risk.
            </p>
            <div className="feature-list">
              <span>Lane-based checks</span>
              <span>Saved SKU rules</span>
              <span>Broker-ready report</span>
              <span>Landed-cost roadmap</span>
            </div>
          </div>
          <div className="app-mockup">
            <div className="mock-sidebar">
              <b>TradeDocAI</b>
              <span>Dashboard</span>
              <span>Invoices</span>
              <span>SKU rules</span>
              <span>Brokers</span>
            </div>
            <div className="mock-main">
              <div className="mock-top">
                <span>Commercial invoice</span>
                <StatusBadge status="critical" />
              </div>
              <div className="lane-selector">
                <button>India to US</button>
                <button className="active">India to UK</button>
                <button>UK to EU</button>
              </div>
              <div className="mock-grid">
                <div>
                  <small>HS confidence</small>
                  <strong>42%</strong>
                </div>
                <div>
                  <small>Customs risk</small>
                  <strong>High</strong>
                </div>
                <div>
                  <small>Fixes needed</small>
                  <strong>3</strong>
                </div>
              </div>
              <div className="mock-flags">
                <div><b>Missing origin</b><span>Add country per line item</span></div>
                <div><b>Weak description</b><span>Replace "accessories" with product material/use</span></div>
                <div><b>Tax ID check</b><span>Buyer VAT/EORI not found</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section audience-section">
          <div className="container audience-inner">
            <div>
              <div className="eyebrow">Who it is for</div>
              <h2>Start with sellers. Grow into brokers.</h2>
            </div>
            <div className="grid-3">
              {segments.map(([title, body]) => (
                <div className="card" key={title}>
                  <h3>{title}</h3>
                  <p className="muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section container final-cta">
          <div>
            <h2>Before you ship, run the paperwork once.</h2>
            <p className="lead">Catch the customs mistake while it is still cheap to fix.</p>
          </div>
          <Link className="button" href="/register">Check first invoice free</Link>
        </section>
      </main>
    </div>
  );
}
