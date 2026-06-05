import type { Metadata } from "next";
import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = {
  title: "Mon Panier — Rivendy",
  description: "Gérez votre panier d'achats sur Rivendy et finalisez votre commande.",
};

export default function CartPage() {
  return <CartView />;
}
