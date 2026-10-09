import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  active: "Actif",
  boosted: "Boosté",
  sold: "Vendu",
  validated: "Validé",
  pending: "En attente",
  epuise: "Épuisé",
  rejected: "Refusé",
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
