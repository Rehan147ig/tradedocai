import Link from "next/link";

type UpgradeModalProps = {
  feature: string;
  requiredPlan: string;
  plan?: string;
  limit?: number;
  onClose: () => void;
};

function formatPlan(plan?: string) {
  if (!plan) return "current";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function modalCopy({ feature, requiredPlan, plan, limit }: Omit<UpgradeModalProps, "onClose">) {
  if (feature === "PLAN_LIMIT_REACHED") {
    return `You've used all ${limit ?? "available"} checks this month on your ${formatPlan(plan)} plan.`;
  }
  if (feature === "SKU_LIMIT_REACHED") {
    return `You've reached the SKU memory limit on your ${formatPlan(plan)} plan.`;
  }
  if (feature === "FEATURE_NOT_IN_PLAN") {
    return `This feature requires ${formatPlan(requiredPlan)}.`;
  }
  return `${feature} needs the ${formatPlan(requiredPlan)} plan.`;
}

export function UpgradeModal({ feature, requiredPlan, plan, limit, onClose }: UpgradeModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="upgrade-modal">
        <h3>You have reached your plan limit</h3>
        <p className="muted">{modalCopy({ feature, requiredPlan, plan, limit })}</p>
        <div className="actions">
          <Link className="button" href="/pricing">Upgrade to Pro — See plans</Link>
          <Link className="button secondary" href="/pricing">See all plan features</Link>
          <button className="button secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
