import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { KeepVideo } from "@/features/play/player/play-dock";
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
  // Clips (refonte du 2026-10-26) : l'écran du clip lit lui-même la vidéo ; les anciens liens y mènent.
  if (kind === "clip") permanentRedirect(`/play/clip/${id.toLowerCase()}`);
  const s = start != null && /^\d{1,6}$/.test(start) ? Number(start) : null;
  const lid = id.toLowerCase();
  // La lecture vit à la racine du site (mini-lecteur, 2026-10-31) : elle continue
  // en quittant cette page, et la retrouver ici ne la relance pas.
  return (
    <KeepVideo sessionKey={`${kind}:${lid}`} href={`/play/watch/${kind}/${lid}`}>
      <WatchView kind={kind as WatchKind} id={lid} start={s} />
    </KeepVideo>
  );
}
