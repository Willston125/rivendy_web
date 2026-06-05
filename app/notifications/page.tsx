import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { NotificationsView } from "@/features/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Mes Notifications — Rivendy",
  description: "Consultez vos codes de livraison, statuts de commandes et commentaires sur Rivendy.",
};

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsView />
    </RequireAuth>
  );
}
