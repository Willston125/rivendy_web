import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { PlayLinkPage, UUID_RE, type PlayLinkContent } from "@/features/play/play-link-page";

/**
 * Rivendy Play — lien partagé d'un Short (lot K de l'audit 16, 2026-10-14) :
 * `/play/short/public/{id}` (Short du public, validé par Rivendy) ou
 * `/play/short/rivendy/{id}` (short de Rivendy). Vidéo publique : elle se lit
 * ici au toucher, sans compte. Avec l'app, Android l'ouvre directement.
 * Contenu publié par des membres : la page n'est pas proposée aux moteurs.
 */

type Kind = "public" | "rivendy";

const getShort = cache(async (kind: string, id: string): Promise<PlayLinkContent | null> => {
  if ((kind !== "public" && kind !== "rivendy") || !UUID_RE.test(id)) return null;
  const db = createAnonServerClient();
  if ((kind as Kind) === "public") {
    // RLS : Short publié et vidéo prête seulement (filtres redits ici).
    const { data } = await db
      .from("play_user_shorts")
      .select("id, author_name, caption, video_uid, thumbnail_url, status, video_status")
      .eq("id", id)
      .eq("status", "published")
      .eq("video_status", "ready")
      .maybeSingle();
    if (!data) return null;
    const name = (data.author_name as string | null)?.trim() || "Membre Rivendy";
    const caption = (data.caption as string | null)?.trim() || null;
    return {
      kicker: "Short · Rivendy Play",
      title: caption ? (caption.length > 80 ? `${caption.slice(0, 79)}…` : caption) : `Le Short de ${name}`,
      subtitle: `Par ${name}`,
      image: data.thumbnail_url as string | null,
      videoUid: data.video_uid as string,
      vertical: true,
    };
  }
  const { data } = await db
    .from("play_titles")
    .select("id, kind, title, synopsis, thumbnail_url, poster_url, public_video_uid")
    .eq("id", id)
    .eq("kind", "short")
    .maybeSingle();
  if (!data || !data.public_video_uid) return null;
  return {
    kicker: "Short · Rivendy Play",
    title: data.title as string,
    subtitle: "Par Rivendy Play",
    description: data.synopsis as string | null,
    image: (data.thumbnail_url as string | null) || (data.poster_url as string | null),
    videoUid: data.public_video_uid as string,
    vertical: true,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}): Promise<Metadata> {
  const { kind, id } = await params;
  const c = await getShort(kind, id);
  if (!c) return { title: "Vidéo indisponible — Rivendy Play", robots: { index: false } };
  return {
    title: `${c.title} — Rivendy Play`,
    description: c.subtitle ?? "Un Short à regarder sur Rivendy Play.",
    robots: { index: false },
    openGraph: {
      title: c.title,
      description: c.subtitle ?? "",
      images: c.image ? [{ url: c.image }] : [],
      type: "video.other",
    },
  };
}

export default async function PlayShortLinkPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const c = await getShort(kind, id);
  // Audit 17 (WEB-21) : introuvable → 404.
  if (!c) notFound();
  // Chemin repris seulement s'il est VALIDE (type connu, uuid) : il entre dans
  // une adresse intent:// (« J'ai déjà l'application »).
  return <PlayLinkPage path={c ? `/play/short/${kind}/${id.toLowerCase()}` : "/play"} content={c} />;
}
