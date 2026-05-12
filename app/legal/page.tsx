import { Suspense } from "react";
import { LegalView } from "@/features/legal/legal-view";

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
