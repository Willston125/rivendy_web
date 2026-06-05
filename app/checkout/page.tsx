import type { Metadata } from "next";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { RequireAuth } from "@/features/auth/require-auth";

export const metadata: Metadata = {
  title: "Finaliser ma commande — Rivendy",
  description: "Sécurisez vos achats et finalisez votre commande sur Rivendy.",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <RequireAuth>
        <CheckoutForm />
      </RequireAuth>
    </div>
  );
}
