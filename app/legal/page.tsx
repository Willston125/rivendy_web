import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalView } from "@/features/legal/legal-view";

export const metadata: Metadata = {
  title: "Mentions Légales & CGU — Rivendy",
  description: "Consultez les conditions générales d'utilisation et la politique de confidentialité de Rivendy.",
};

export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const defaultTab = tab === "privacy" ? "privacy" : "cgu";

  return (
    <Suspense fallback={null}>
      <LegalView defaultTab={defaultTab} />
    </Suspense>
  );
}
