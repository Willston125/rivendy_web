import type { Metadata } from "next";
import { SearchView } from "@/features/search/search-view";
import { CATEGORIES, type CategoryId } from "@/types/rivendy";

export const metadata: Metadata = {
  title: "Rechercher — Rivendy",
  description: "Recherchez des produits et boutiques sur Rivendy Marketplace.",
};

// Un lien /search?q=robe (partagé, en favori) lance la recherche à l'ouverture :
// la page démarrait vide et ignorait ?q= et ?category=.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const initialCategory = CATEGORIES.some((c) => c.id === category) ? (category as CategoryId) : null;
  return <SearchView initialQuery={q?.slice(0, 100) ?? ""} initialCategory={initialCategory} />;
}
