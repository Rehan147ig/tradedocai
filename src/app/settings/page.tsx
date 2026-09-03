"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type User = { email: string; fullName: string | null; companyName: string | null; companyCountry: string | null; companyAddress: string | null; plan: string };

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({ fullName: "", companyName: "", companyCountry: "", companyAddress: "" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) { location.href = "/login"; return; }
    const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setForm({
        fullName: data.user.fullName ?? "",
        companyName: data.user.companyName ?? "",
        companyCountry: data.user.companyCountry ?? "",
        companyAddress: data.user.companyAddress ?? "",
      });
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("tradedocai_token");
    if (!token) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(data.error ?? "Save failed"); return; }
    setUser(data.user);
    setMsg("✅ Saved — ClearShip will use this origin for HS/duty rules (no more hardcoded India).");
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Settings</h2>
        <p className="muted" style={{ fontSize: 12 }}>Set your origin address — used for lane inference when Shopify store location isn’t available. Affects duties & restricted checks.</p>
        <div className="panel" style={{ padding: 22 }}>
          {!user ? <p className="muted">Loading profile...</p> : (
            <>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Plan:</strong> {user.plan}</p>
              <form onSubmit={save} style={{ display: "grid", gap: 12, marginTop: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Full name <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Doe" /></label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Company <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Exports" /></label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Company country (origin) — e.g. United Kingdom, India, United States <input className="input" value={form.companyCountry} onChange={(e) => setForm({ ...form, companyCountry: e.target.value })} placeholder="India" /></label>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Company address <textarea className="input textarea" value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} placeholder="123 Export Street, Mumbai, India" /></label>
                {msg ? <p style={{ fontSize: 12, color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</p> : null}
                <button className="button" disabled={saving} style={{ justifySelf: "start" }}>{saving ? "Saving..." : "Save origin →"}</button>
              </form>
              <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>If a Shopify store is connected, we try its <code>shop.json country_name</code> first, then fall back to this. Set it for accurate UK→EU / India→EU lanes.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
