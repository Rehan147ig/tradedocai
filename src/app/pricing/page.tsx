import Link from "next/link";
import { Topbar } from "@/components/Topbar";

const plans = [
  ["Free", "£0", "20 docs/month", "50 MB storage", "30 day retention"],
  ["Starter", "£39", "200 docs/month", "2 GB storage", "6 month retention"],
  ["Pro", "£99", "1,000 docs/month", "10 GB storage", "1 year retention"],
  ["Broker", "£299", "Unlimited docs", "50 GB storage", "Client portal ready"],
];

export default function PricingPage() {
  return (
    <div className="shell">
      <Topbar />
      <main className="container" style={{ padding: "56px 0" }}>
        <h1 style={{ fontSize: 56 }}>Pricing</h1>
        <p className="lead">Start with a free validation loop, then upgrade when document volume or storage becomes real.</p>
        <div className="pricing-grid">
          {plans.map(([name, price, docs, storage, retention]) => (
            <div className="card" key={name}>
              <h3>{name}</h3>
              <h2>{price}</h2>
              <p>{docs}</p>
              <p>{storage}</p>
              <p>{retention}</p>
              <Link className="button" href={name === "Free" ? "/register" : "/dashboard"}>
                {name === "Free" ? "Start free" : "Upgrade"}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
