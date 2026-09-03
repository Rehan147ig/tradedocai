"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type User = { email: string; fullName: string | null; companyName: string | null; plan: string };

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => setUser(data.user));
  }, []);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Settings</h2>
        <div className="panel" style={{ padding: 22 }}>
          {!user ? <p className="muted">Loading profile...</p> : null}
          {user ? (
            <>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Name:</strong> {user.fullName ?? "Not set"}
              </p>
              <p>
                <strong>Company:</strong> {user.companyName ?? "Not set"}
              </p>
              <p>
                <strong>Plan:</strong> {user.plan}
              </p>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
