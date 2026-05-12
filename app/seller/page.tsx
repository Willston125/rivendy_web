import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SellerDashboard } from "@/features/seller/seller-dashboard";

export const metadata: Metadata = {
  title: "Mon espace vendeur — Rivendy",
  description: "Gérez vos produits, suivez vos commandes et retirez vos gains sur Rivendy.",
};

export default function SellerPage() {
  return (
    <RequireAuth>
      <SellerDashboard />
    </RequireAuth>
  );
}
