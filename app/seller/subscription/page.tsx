import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SubscriptionView } from "@/features/seller/subscription-view";

export const metadata: Metadata = {
  title: "Rivendy+ pour vendre — Rivendy",
  description: "Le badge certifié, des boosts chaque mois et plus de visibilité pour vos articles, avec Rivendy+.",
};

export default function SubscriptionPage() {
  return (
    <RequireAuth>
      <SubscriptionView />
    </RequireAuth>
  );
}
