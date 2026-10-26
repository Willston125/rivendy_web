import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Confirmer votre adresse — Rivendy",
  description: "Confirmez votre adresse de récupération Rivendy.",
  // L'URL porte le jeton en paramètre : jamais d'indexation.
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
