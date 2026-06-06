import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountShell } from "@/features/account/account-shell";
import { ProfileInfoForm } from "@/features/profile/profile-info-form";

export const metadata: Metadata = {
  title: "Mes Informations Personnelles — Rivendy",
  description: "Gérez vos informations personnelles, votre numéro de téléphone et vos coordonnées sur Rivendy.",
};

export default function ProfileInfoPage() {
  return (
    <RequireAuth>
      <AccountShell>
        <ProfileInfoForm />
      </AccountShell>
    </RequireAuth>
  );
}
