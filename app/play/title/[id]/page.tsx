import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { PlayLinkPage, UUID_RE, type PlayLinkContent } from "@/features/play/play-link-page";

/**
 * Rivendy Play — lien partagé d'un film, d'une série ou d'un clip (lot K de
 * l'audit 16, 2026-10-14). Avec l'app, Android ne passe pas par ici (App
 * Link) ; sans elle, l'affiche, le synopsis et la bande-annonce (publique),
 * ou le clip d'un artiste (public). Un film ne se lit JAMAIS sur le site.
 */

type TitleRow = {
  id: string;
  kind: string;
  title: string;
  synopsis: string | null;
  genre: string | null;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  thumbnail_url: string | null;
  trailer_uid: string | null;
  trailer_status: string | null;
  public_video_uid: string | null;
  artist: string | null;
};

// La RLS ne rend que les titres publiés ; colonnes listées (select=* refusé).
const getTitle = cache(async (id: string): Promise<TitleRow | null> => {
  if (!UUID_RE.test(id)) return null;
  const { data } = await createAnonServerClient()
    .from("play_titles")
    .select(
      "id, kind, title, synopsis, genre, release_year, poster_url, backdrop_url, thumbnail_url, trailer_uid, trailer_status, public_video_uid, artist",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as TitleRow | null) ?? null;
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

const KIND_LABEL: Record<string, string> = { film: "Film", serie: "Série", clip: "Clip", short: "Short" };

function toContent(t: TitleRow): PlayLinkContent {
  const meta = [KIND_LABEL[t.kind] ?? "Rivendy Play", t.genre, t.release_year].filter(Boolean).join(" · ");
  return {
    kicker: "Rivendy Play",
    title: t.title,
    subtitle: t.kind === "clip" && t.artist ? `${t.artist} · ${meta}` : meta,
    description: t.synopsis,
    image: t.poster_url || t.thumbnail_url || t.backdrop_url,
    // Clip d'artiste : vidéo publique ; sinon la bande-annonce si elle est prête.
    videoUid: t.public_video_uid || (t.trailer_status === "ready" ? t.trailer_uid : null),
    vertical: t.kind === "short",
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTitle(id);
  if (!t) return { title: "Vidéo indisponible — Rivendy Play", robots: { index: false } };
  const c = toContent(t);
  return {
    title: `${t.title} — Rivendy Play`,
    description: t.synopsis?.slice(0, 160) || `Regardez « ${t.title} » sur Rivendy Play, dans l’application Rivendy.`,
    alternates: { canonical: `${SITE_URL}/play/title/${t.id}` },
    openGraph: {
      title: `${t.title} — Rivendy Play`,
      description: t.synopsis?.slice(0, 200) ?? "",
      images: c.image ? [{ url: c.image }] : [],
      type: "video.other",
    },
  };
}

export default async function PlayTitleLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTitle(id);
  // Audit 17 (WEB-21) : introuvable → 404 (écran « indisponible » : not-found.tsx).
  if (!t) notFound();
  // Chemin bâti sur l'identifiant VALIDÉ (lu en base), jamais sur l'URL brute :
  // il entre dans une adresse intent:// (« J'ai déjà l'application »).
  return <PlayLinkPage path={t ? `/play/title/${t.id}` : "/play"} content={t ? toContent(t) : null} />;
}
