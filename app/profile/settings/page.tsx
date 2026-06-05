import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SettingsView } from "@/features/profile/settings-view";

export const metadata: Metadata = {
  title: "Paramètres de mon compte — Rivendy",
  description: "Configurez les paramètres de votre compte, de vos notifications et de vos préférences de profil sur Rivendy.",
};

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}
