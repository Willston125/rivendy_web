import { SITE_URL, clip, safeJsonLd } from "@/lib/seo";
import { cover, durationLabel, kindLabel, streamThumbnail, titlePath, wideImage, type PlayEpisode, type PlayTitle } from "../play-logic";

/**
 * Données structurées des pages publiques de Rivendy Play (§14.4) : Movie,
 * TVSeries, TVEpisode, VideoObject. Aucune adresse de média Premium : seule la
 * bande-annonce (publique) est décrite.
 */

const isoDuration = (s: number | null | undefined) => {
  const n = Math.round(Number(s ?? 0));
  if (n <= 0) return undefined;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec && !h ? `${sec}S` : ""}` || undefined;
};

export function titleDescription(t: PlayTitle): string {
  const fallback = `${kindLabel(t.kind)} à regarder sur Rivendy Play, sur le site et dans l’application Rivendy.`;
  return clip(t.synopsis?.trim() || fallback, 155);
}

export function titleJsonLd(t: PlayTitle): Record<string, unknown> {
  const url = `${SITE_URL}${titlePath(t)}`;
  const image = cover(t) || wideImage(t) || undefined;
  const base = {
    "@context": "https://schema.org",
    name: t.title,
    url,
    description: t.synopsis?.slice(0, 500) || undefined,
    image,
    genre: t.genre || undefined,
    dateCreated: t.release_year ? String(t.release_year) : undefined,
    contentRating: t.age_rating || undefined,
  };
  const trailer = t.trailer_uid && t.trailer_status === "ready"
    ? { "@type": "VideoObject", name: `Bande-annonce — ${t.title}`, description: t.synopsis?.slice(0, 200) || t.title,
        thumbnailUrl: streamThumbnail(t.trailer_uid, 480), uploadDate: t.published_at || undefined }
    : undefined;
  if (t.kind === "serie") return { ...base, "@type": "TVSeries", trailer };
  if (t.kind === "clip") {
    return {
      ...base, "@type": "VideoObject", description: base.description || `Clip ${t.artist ? `de ${t.artist} ` : ""}sur Rivendy Play`,
      thumbnailUrl: wideImage(t) || (t.public_video_uid ? streamThumbnail(t.public_video_uid, 480) : undefined),
      uploadDate: t.published_at || undefined, duration: isoDuration(t.duration_seconds),
      ...(t.artist ? { creator: { "@type": "MusicGroup", name: t.artist } } : {}),
    };
  }
  return { ...base, "@type": "Movie", duration: isoDuration(t.duration_seconds), trailer };
}

export function episodeJsonLd(e: PlayEpisode, series: PlayTitle): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: e.title,
    url: `${SITE_URL}/play/episode/${e.id}`,
    episodeNumber: e.episode_number,
    description: e.synopsis?.slice(0, 500) || undefined,
    image: e.thumbnail_url || wideImage(series) || undefined,
    duration: isoDuration(e.duration_seconds),
    partOfSeason: { "@type": "TVSeason", seasonNumber: e.season },
    partOfSeries: { "@type": "TVSeries", name: series.title, url: `${SITE_URL}/play/series/${series.id}` },
  };
}

export function episodeDescription(e: PlayEpisode, series: PlayTitle): string {
  const d = durationLabel(e.duration_seconds);
  return clip(e.synopsis?.trim() || `Saison ${e.season}, épisode ${e.episode_number} de « ${series.title} »${d ? ` (${d})` : ""}, sur Rivendy Play.`, 155);
}

/** Bloc JSON-LD : « < » réellement échappé via safeJsonLd (aucun </script>
 *  saisi par l'artiste ne peut fermer la balise — audit 21, WEBMEDIA-1). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
