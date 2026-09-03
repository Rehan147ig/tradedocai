"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";

type BrokerReview = {
  id: string;
  brokerEmail: string;
  clientName: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  document: { originalFilename: string; status: string };
};

export default function BrokerPage() {
  const [reviews, setReviews] = useState<BrokerReview[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tradedocai_token");
    if (!token) {
      location.href = "/login";
      return;
    }
    fetch("/api/broker-reviews", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load broker reviews");
        setReviews(data.reviews);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="main">
        <h2>Broker Review</h2>
        <p className="muted">Send risky shipments to a broker, keep an audit trail, and track which documents are waiting on review.</p>
        {error ? <p style={{ color: "var(--red)" }}>{error}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Broker</th>
                <th>Client</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.document.originalFilename}</strong>
                    <p><StatusBadge status={review.document.status} /></p>
                  </td>
                  <td>{review.brokerEmail}</td>
                  <td>{review.clientName ?? "Own shipment"}</td>
                  <td>{review.status}</td>
                  <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={5}>No broker review requests yet. Open a document report and send one when a shipment needs expert review.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
