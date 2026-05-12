import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { OrdersView } from "@/features/orders/orders-view";

export const metadata: Metadata = {
  title: "Mes commandes — Rivendy",
  description: "Suivez toutes vos commandes Rivendy en temps réel.",
};

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersView />
    </RequireAuth>
  );
}
