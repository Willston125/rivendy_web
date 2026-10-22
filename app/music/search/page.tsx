import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ q?: string }> };

/** La recherche vit désormais dans « Explorer » (refonte du 2026-10-22) : les anciens liens y mènent. */
export default async function MusicSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  redirect(q ? `/music/explore?q=${encodeURIComponent(q)}` : "/music/explore");
}
