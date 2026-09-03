"use client";

import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS, TourId, markSeen } from "@/lib/tours";

export function TourButton({ tourId, label = "Take a tour", variant = "ghost" }: { tourId: TourId; label?: string; variant?: "ghost" | "primary" }) {
  const start = useCallback(() => {
    const steps = TOUR_STEPS[tourId];
    if (!steps?.length) return;
    const d = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done ✓",
      allowClose: true,
      popoverClass: "tradedocai-driver",
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          title: s.popover.title,
          description: s.popover.description,
          side: s.popover.side ?? "bottom",
          align: "start",
        },
      })),
      onDestroyStarted: () => { markSeen(tourId); d.destroy(); },
    });
    d.drive();
  }, [tourId]);

  return (
    <button
      onClick={start}
      className="button"
      style={{
        fontSize: 12,
        padding: "6px 10px",
        background: variant === "primary" ? "var(--accent)" : "transparent",
        color: variant === "primary" ? "white" : "var(--accent)",
        border: variant === "primary" ? "none" : "1px solid var(--accent)",
      }}
      aria-label={`Start ${tourId} tour`}
    >
      ✨ {label}
    </button>
  );
}

export function useAutoTour(tourId: TourId, delayMs = 900) {
  const start = useCallback(() => {
    const steps = TOUR_STEPS[tourId];
    if (!steps?.length) return;
    if (localStorage.getItem(`tour_seen_${tourId}`)) return;
    const d = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done ✓",
      allowClose: true,
      popoverClass: "tradedocai-driver",
      steps: steps.map((s) => ({
        element: s.element,
        popover: { title: s.popover.title, description: s.popover.description, side: s.popover.side ?? "bottom", align: "start" },
      })),
      onDestroyStarted: () => { markSeen(tourId); d.destroy(); },
    });
    setTimeout(() => d.drive(), delayMs);
  }, [tourId, delayMs]);
  return start;
}
