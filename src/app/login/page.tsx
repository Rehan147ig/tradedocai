"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Topbar } from "@/components/Topbar";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    localStorage.setItem("tradedocai_token", data.token);
    router.push("/dashboard");
  }

  return (
    <div className="shell">
      <Topbar />
      <form className="auth-card form" onSubmit={submit}>
        <h2>Login</h2>
        <input className="input" name="email" type="email" placeholder="Email" required />
        <input className="input" name="password" type="password" placeholder="Password" required />
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        <button className="button" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <p className="muted">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
