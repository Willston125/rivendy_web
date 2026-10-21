import type { Metadata } from "next";
import { SearchView } from "@/features/play/play-views";

type Props = { searchParams: Promise<{ q?: string }> };

export const metadata: Metadata = { title: "Recherche — Rivendy Play", robots: { index: false, follow: true } };

export default async function PlaySearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  return <SearchView initial={(q ?? "").slice(0, 60)} />;
}
