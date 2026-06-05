import type { Metadata } from "next";
import { PromoView } from "@/features/products/promo-view";

export const metadata: Metadata = {
  title: "Bons Plans & Offres du moment — Rivendy",
  description: "Découvrez nos offres spéciales, articles en vedette et nouveautés en promotion sur Rivendy.",
};

export default function PromoPage() {
  return <PromoView />;
}
