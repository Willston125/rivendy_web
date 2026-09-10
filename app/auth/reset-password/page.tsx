import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — Rivendy",
  description: "Choisissez un nouveau mot de passe pour votre compte Rivendy.",
  // Un lien de réinitialisation ne doit jamais se retrouver dans un index :
  // l'URL porte le jeton en paramètre de requête.
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
