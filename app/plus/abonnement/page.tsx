import { Suspense } from "react";
import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SubscriptionView } from "@/features/plus/subscription-view";

export const metadata: Metadata = {
  title: "Mon abonnement Rivendy+ — Rivendy",
  description: "Votre abonnement Rivendy+, vos demandes et vos paiements.",
  robots: { index: false, follow: false },
};

export default function PlusSubscriptionPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <SubscriptionView />
      </Suspense>
    </RequireAuth>
  );
}
