import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountShell } from "@/features/account/account-shell";
import { NotificationPreferencesView } from "@/features/profile/notification-preferences-view";

export const metadata: Metadata = {
  title: "Notifications — Rivendy",
  description: "Choisissez les notifications que Rivendy envoie sur votre téléphone.",
};

export default function NotificationPreferencesPage() {
  return (
    <RequireAuth>
      <AccountShell>
        <NotificationPreferencesView />
      </AccountShell>
    </RequireAuth>
  );
}
