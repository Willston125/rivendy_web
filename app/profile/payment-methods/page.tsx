import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { PaymentMethodsView } from "@/features/profile/payment-methods-view";

export const metadata: Metadata = {
  title: "Mes Méthodes de Paiement — Rivendy",
  description: "Gérez vos comptes de paiement mobile money (D-Money, Waafi, CAC Pay) sur votre espace vendeur Rivendy.",
};

export default function PaymentMethodsPage() {
  return (
    <RequireAuth>
      <PaymentMethodsView />
    </RequireAuth>
  );
}
