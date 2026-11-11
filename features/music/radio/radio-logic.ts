/**
 * Radios en direct sur le site (2026-11-11, canevas validé le même jour).
 * Règles pures, testées par radio-logic.test.mjs. Les radios viennent de
 * `music_radio_list` (en ligne, avec la lettre signée de la station) ou de
 * `music_radio_preview` (aperçu privé, par le lien secret de la station) :
 * 20261111_1200_radio_direct.sql. Le site n'invente aucune radio.
 */

export type RadioRegion = "comores" | "ocean_indien" | "monde";
export type RadioFormat = "mp3" | "aac" | "hls";

export type RadioStation = {
  id: string;
  name: string;
  place: string | null;
  region: RadioRegion;
  stream_url: string;
  stream_format: RadioFormat;
  homepage_url: string | null;
  logo_url: string | null;
  /** Rendu par l'aperçu privé seulement. */
  status?: "preview" | "live";
};

export const RADIO_REGIONS: RadioRegion[] = ["comores", "ocean_indien", "monde"];

export const RADIO_REGION_LABELS: Record<RadioRegion, string> = {
  comores: "Comores",
  ocean_indien: "Océan Indien",
  monde: "Monde",
};

/** Signe de vie de l'écoute (compteur des stations) : toutes les 60 s. */
export const RADIO_PING_MS = 60_000;

const HTTPS = /^https:\/\/\S+$/;
const FORMATS: RadioFormat[] = ["mp3", "aac", "hls"];

/** Une radio lue du serveur, ou null si la réponse ne tient pas debout. */
export function parseRadioStation(raw: unknown): RadioStation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.stream_url !== "string") return null;
  if (!HTTPS.test(r.stream_url)) return null;
  const region = RADIO_REGIONS.includes(r.region as RadioRegion) ? (r.region as RadioRegion) : "monde";
  const format = FORMATS.includes(r.stream_format as RadioFormat) ? (r.stream_format as RadioFormat) : "mp3";
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const logo = text(r.logo_url);
  const site = text(r.homepage_url);
  return {
    id: r.id,
    name: r.name.trim(),
    place: text(r.place),
    region,
    stream_url: r.stream_url,
    stream_format: format,
    homepage_url: site && /^https?:\/\/\S+$/.test(site) ? site : null,
    logo_url: logo && HTTPS.test(logo) ? logo : null,
    status: r.status === "preview" || r.status === "live" ? r.status : undefined,
  };
}

export function parseRadioStations(raw: unknown): RadioStation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseRadioStation).filter((s): s is RadioStation => s !== null);
}

/** Radios rangées par rubrique (Comores, Océan Indien, Monde), sans rubrique vide. */
export function groupRadiosByRegion(list: RadioStation[]): Array<{ region: RadioRegion; label: string; stations: RadioStation[] }> {
  return RADIO_REGIONS
    .map((region) => ({ region, label: RADIO_REGION_LABELS[region], stations: list.filter((s) => s.region === region) }))
    .filter((g) => g.stations.length > 0);
}

/** Délai avant le n-ième nouvel essai après une coupure (1, 2, 3) ; null : on s'arrête. */
export function radioRetryDelay(attempt: number): number | null {
  return [2000, 5000, 10000][attempt - 1] ?? null;
}

/** Une radio HLS ne joue que si le navigateur lit le HLS lui-même (Safari, Chrome récent). */
export function radioPlayableHere(format: RadioFormat, canPlayHls: boolean): boolean {
  return format !== "hls" || canPlayHls;
}

/** Secondes d'écoute à déclarer depuis le dernier envoi (0 à 120). */
export function radioListenSeconds(msSinceLast: number): number {
  if (!Number.isFinite(msSinceLast) || msSinceLast <= 0) return 0;
  return Math.min(120, Math.round(msSinceLast / 1000));
}

/** Initiales d'une radio sans logo : « Radio Océan Indien » → « ROI ». */
export function radioInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}
