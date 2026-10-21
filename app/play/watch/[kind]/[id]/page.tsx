import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchView, type WatchKind } from "@/features/play/player/watch-view";
import { UUID_RE } from "@/features/play/server/play-server";

type Props = { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ start?: string }> };

const KINDS: readonly string[] = ["movie", "episode", "clip"];

// Lecteur : connexion obligatoire, droits vérifiés par le serveur ; jamais indexé.
export const metadata: Metadata = { title: "Lecture — Rivendy Play", robots: { index: false, follow: false } };

export default async function PlayWatchPage({ params, searchParams }: Props) {
  const { kind, id } = await params;
  const { start } = await searchParams;
  if (!KINDS.includes(kind) || !UUID_RE.test(id)) notFound();
  const s = start != null && /^\d{1,6}$/.test(start) ? Number(start) : null;
  return <WatchView key={`${kind}:${id}`} kind={kind as WatchKind} id={id.toLowerCase()} start={s} />;
}
