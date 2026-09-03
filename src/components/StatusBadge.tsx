type Props = {
  status: string;
};

const labels: Record<string, string> = {
  ready: "Ready",
  ready_to_ship: "Ready",
  needs_review: "Needs review",
  critical: "Critical",
  critical_issues: "Critical",
  processing: "Processing",
};

export function StatusBadge({ status }: Props) {
  return <span className={`status ${status}`}>{labels[status] ?? status}</span>;
}
