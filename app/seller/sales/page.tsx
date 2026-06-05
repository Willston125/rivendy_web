import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { SellerSalesView } from "@/features/seller/seller-sales-view";

export const metadata: Metadata = {
  title: "Mes Ventes — Rivendy",
  description: "Consultez l'état de vos ventes, vos produits et gérez vos commandes en cours sur Rivendy.",
};

export default function SellerSalesPage() {
  return (
    <RequireAuth>
      <SellerSalesView />
    </RequireAuth>
  );
}
