"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Topbar } from "@/components/Topbar";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        fullName: form.get("fullName"),
        companyName: form.get("companyName"),
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }
    localStorage.setItem("tradedocai_token", data.token);
    router.push("/dashboard");
  }

  return (
    <div className="shell">
      <Topbar />
      <form className="auth-card form" onSubmit={submit}>
        <h2>Create account</h2>
        <input className="input" name="fullName" placeholder="Full name" required />
        <input className="input" name="companyName" placeholder="Company name" />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <input className="input" name="password" type="password" placeholder="Password" minLength={8} required />
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        <button className="button" disabled={loading}>
          {loading ? "Creating..." : "Start free"}
        </button>
        <p className="muted">
          Already registered? <Link href="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
