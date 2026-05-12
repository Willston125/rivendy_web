import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  active: "Actif",
  boosted: "Booste",
  sold: "Vendu",
  validated: "Valide",
  pending: "En attente",
  epuise: "Epuise",
  rejected: "Refuse",
};

export function ProductStatusBadge({ status }: { status: string }) {
  const variant =
    status === "active" || status === "boosted"
      ? "default"
      : status === "pending"
        ? "warning"
        : status === "rejected"
          ? "danger"
          : "secondary";

  return <Badge variant={variant}>{statusLabels[status] ?? status}</Badge>;
}
