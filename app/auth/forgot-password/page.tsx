import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié — Rivendy",
  description: "Réinitialisez votre mot de passe Rivendy en utilisant votre numéro de téléphone.",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
