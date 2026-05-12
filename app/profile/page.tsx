import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { ProfileDashboard } from "@/features/profile/profile-dashboard";

export const metadata: Metadata = {
  title: "Mon profil — Rivendy",
  description: "Gérez votre compte Rivendy : informations personnelles, commandes, favoris et boutique.",
};

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileDashboard />
    </RequireAuth>
  );
}
