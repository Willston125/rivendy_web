import type { Metadata } from "next";
import { SearchView } from "@/features/search/search-view";

export const metadata: Metadata = {
  title: "Rechercher — Rivendy",
  description: "Recherchez des produits et boutiques sur Rivendy Marketplace.",
};

export default function SearchPage() {
  return <SearchView />;
}
