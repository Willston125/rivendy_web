import type { Metadata } from "next";
import { PreorderCatalogView } from "@/features/products/preorder-catalog-view";

export const metadata: Metadata = {
  title: "Articles sur commande — Rivendy",
  description: "Découvrez et achetez des articles exclusifs disponibles sur commande sur Rivendy.",
};

export default function PreordersPage() {
  return <PreorderCatalogView />;
}
