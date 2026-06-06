import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountShell } from "@/features/account/account-shell";
import { ChangePasswordForm } from "@/features/profile/change-password-form";

export const metadata: Metadata = {
  title: "Modifier mon mot de passe — Rivendy",
  description: "Modifiez le mot de passe de votre compte Rivendy en toute sécurité.",
};

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <AccountShell>
        <ChangePasswordForm />
      </AccountShell>
    </RequireAuth>
  );
}
