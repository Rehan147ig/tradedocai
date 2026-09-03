"use client";

import { FormEvent, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UpgradeModal } from "@/components/UpgradeModal";

type Product = {
  id: string;
  sku: string;
  name: string;
  customsDescription: string;
  hsCode: string;
  countryOfOrigin: string;
  material: string | null;
  defaultLane: string | null;
  confidenceNote: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [upgrade, setUpgrade] = useState<{ feature: string; requiredPlan: string; plan?: string; limit?: number } | null>(null);

  async function loadProducts() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    const response = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not load products");
      return;
    }
    setProducts(data.products);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sku: form.get("sku"),
        name: form.get("name"),
        customsDescription: form.get("customsDescription"),
        hsCode: String(form.get("hsCode") ?? "").replace(/[.\s]/g, ""),
        countryOfOrigin: form.get("countryOfOrigin"),
        material: form.get("material"),
        defaultLane: form.get("defaultLane"),
        confidenceNote: form.get("confidenceNote"),
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      if (data.error === "PLAN_LIMIT_REACHED" || data.error === "SKU_LIMIT_REACHED" || data.error === "FEATURE_NOT_IN_PLAN") {
        setUpgrade({ feature: data.error, requiredPlan: data.requiredPlan ?? "pro", plan: data.plan, limit: data.limit });
        return;
      }
      setError(data.error ?? "Could not save product");
      return;
    }
    event.currentTarget.reset();
    loadProducts();
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        {upgrade ? <UpgradeModal feature={upgrade.feature} requiredPlan={upgrade.requiredPlan} plan={upgrade.plan} limit={upgrade.limit} onClose={() => setUpgrade(null)} /> : null}
        <h2>SKU Compliance Memory</h2>
        <p className="muted">
          Save HS codes, origin, materials, and customs descriptions once. Future invoices can be checked against this product memory automatically.
        </p>

        <section className="panel" style={{ padding: 22, marginBottom: 22 }}>
          <h3>Add or update product rule</h3>
          <form className="form product-form" onSubmit={submit}>
            <input className="input" name="sku" placeholder="SKU, for example BAG-COT-001" required />
            <input className="input" name="name" placeholder="Product name" required />
            <input className="input" name="hsCode" placeholder="HS code, for example 420222" required />
            <input className="input" name="countryOfOrigin" placeholder="Country of origin, for example India" required />
            <input className="input" name="material" placeholder="Material, for example 100% cotton" />
            <input className="input" name="defaultLane" placeholder="Default lane, for example India to UK" />
            <textarea className="input textarea" name="customsDescription" placeholder="Customs-safe description, not vague marketing text" required />
            <textarea className="input textarea" name="confidenceNote" placeholder="Optional note: source, broker confirmation, or why this code is used" />
            {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
            <button className="button" disabled={saving}>
              {saving ? "Saving..." : "Save SKU rule"}
            </button>
          </form>
        </section>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>HS</th>
                <th>Origin</th>
                <th>Lane</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>
                    <strong>{product.name}</strong>
                    <p className="muted">{product.customsDescription}</p>
                  </td>
                  <td>{product.hsCode}</td>
                  <td>{product.countryOfOrigin}</td>
                  <td>{product.defaultLane ?? "Any"}</td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5}>No saved SKU rules yet. Add your first product to make future checks faster.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
