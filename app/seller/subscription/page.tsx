import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SubscriptionView } from "@/features/seller/subscription-view";

export const metadata: Metadata = {
  title: "Abonnement Vendeur Certifié — Rivendy",
  description: "Obtenez le badge certifié Rivendy, augmentez votre visibilité et développez votre activité.",
};

export default function SubscriptionPage() {
  return (
    <RequireAuth>
      <SubscriptionView />
    </RequireAuth>
  );
}
