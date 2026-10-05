/**
 * 🔗 CRITÈRES ET BROUILLON DANS L'URL
 *
 * L'app garde le brouillon de réservation dans un Provider en mémoire. Sur
 * le web, la mémoire ne survit ni à un rechargement, ni à l'aller-retour par
 * la page de connexion : le brouillon vit donc dans l'URL.
 *
 *   ?hotel=<uuid>&in=AAAA-MM-JJ&out=AAAA-MM-JJ&r=1&a=2&c=0&room=<uuid>&s=<uuid>,<uuid>
 *
 * ⚠️ Aucun montant n'y figure, jamais : le prix vient du devis serveur
 * (`hotel_quote`), recalculé à chaque étape.
 */

import { isSqlDate } from "./dates";

// Bornes du sélecteur de voyageurs de l'app (`HotelGuestSelectorSheet`).
export const MAX_ROOMS = 8;
export const MAX_ADULTS = 16;
export const MAX_CHILDREN = 10;

export const RESULTS_PAGE_SIZE = 20;

export type HotelSort = "recommended" | "price_asc" | "price_desc" | "rating_desc";

export const SORT_LABELS: Record<HotelSort, string> = {
  recommended: "Recommandés",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  rating_desc: "Mieux notés",
};

export interface Guests {
  rooms: number;
  adults: number;
  children: number;
}

export interface HotelSearchQuery extends Guests {
  /** Ville, région ou nom d'établissement. Vide = tout le marché. */
  destination: string;
  checkIn: string | null;
  checkOut: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  /** Classements retenus (2 à 5 étoiles, comme le filtre de l'app). */
  stars: number[];
  amenities: string[];
  sort: HotelSort;
}

export interface BookingDraft extends Guests {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  roomId: string | null;
  serviceIds: string[];
}

type ParamSource =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | null {
  if (typeof (source as { get?: unknown }).get === "function") {
    return (source as { get(name: string): string | null }).get(key);
  }
  const v = (source as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si la valeur est un UUID — évite d'envoyer une saisie arbitraire à Postgres (22P02). */
export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

function intIn(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw == null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function positiveOrNull(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Applique les bornes de l'app : au moins 1 adulte et 1 chambre, jamais
 * plus de chambres que d'adultes (une chambre sans adulte ferait échouer la
 * réservation côté serveur).
 */
export function normalizeGuests(g: Guests): Guests {
  const rooms = Math.min(MAX_ROOMS, Math.max(1, Math.trunc(g.rooms) || 1));
  const adults = Math.min(MAX_ADULTS, Math.max(1, Math.trunc(g.adults) || 1));
  const children = Math.min(MAX_CHILDREN, Math.max(0, Math.trunc(g.children) || 0));
  return { rooms: Math.min(rooms, adults), adults, children };
}

function readGuests(source: ParamSource): Guests {
  return normalizeGuests({
    rooms: intIn(read(source, "r"), 1, MAX_ROOMS, 1),
    adults: intIn(read(source, "a"), 1, MAX_ADULTS, 2),
    children: intIn(read(source, "c"), 0, MAX_CHILDREN, 0),
  });
}

export function parseSearchQuery(source: ParamSource): HotelSearchQuery {
  const checkIn = read(source, "in");
  const checkOut = read(source, "out");
  const sortRaw = read(source, "sort") as HotelSort | null;
  const stars = (read(source, "stars") ?? "")
    .split(",")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => n >= 1 && n <= 5);
  const amenities = (read(source, "amen") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9_]{1,40}$/.test(s));
  return {
    destination: (read(source, "q") ?? "").slice(0, 80),
    checkIn: isSqlDate(checkIn) ? checkIn : null,
    checkOut: isSqlDate(checkOut) ? checkOut : null,
    ...readGuests(source),
    minPrice: positiveOrNull(read(source, "min")),
    maxPrice: positiveOrNull(read(source, "max")),
    stars: Array.from(new Set(stars)).sort(),
    amenities: Array.from(new Set(amenities)),
    sort: sortRaw && sortRaw in SORT_LABELS ? sortRaw : "recommended",
  };
}

export const EMPTY_SEARCH: HotelSearchQuery = {
  destination: "",
  checkIn: null,
  checkOut: null,
  rooms: 1,
  adults: 2,
  children: 0,
  minPrice: null,
  maxPrice: null,
  stars: [],
  amenities: [],
  sort: "recommended",
};

/** Paramètres de séjour seuls (dates + voyageurs) — transportés d'écran en écran. */
export function stayParams(q: Pick<HotelSearchQuery, "checkIn" | "checkOut"> & Guests): URLSearchParams {
  const p = new URLSearchParams();
  if (q.checkIn) p.set("in", q.checkIn);
  if (q.checkOut) p.set("out", q.checkOut);
  p.set("r", String(q.rooms));
  p.set("a", String(q.adults));
  p.set("c", String(q.children));
  return p;
}

export function searchQueryToParams(q: HotelSearchQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.destination.trim()) p.set("q", q.destination.trim());
  stayParams(q).forEach((v, k) => p.set(k, v));
  if (q.minPrice != null) p.set("min", String(q.minPrice));
  if (q.maxPrice != null) p.set("max", String(q.maxPrice));
  if (q.stars.length) p.set("stars", q.stars.join(","));
  if (q.amenities.length) p.set("amen", q.amenities.join(","));
  if (q.sort !== "recommended") p.set("sort", q.sort);
  return p;
}

export function resultsHref(q: HotelSearchQuery): string {
  return `/hotels/results?${searchQueryToParams(q).toString()}`;
}

export function hotelHref(hotelId: string, stay?: Pick<HotelSearchQuery, "checkIn" | "checkOut"> & Guests): string {
  if (!stay) return `/hotels/${hotelId}`;
  return `/hotels/${hotelId}?${stayParams(stay).toString()}`;
}

/** Nombre de filtres actifs — pastille du bouton « Filtres » (miroir `activeFilterCount`). */
export function activeFilterCount(q: HotelSearchQuery): number {
  return (q.minPrice != null || q.maxPrice != null ? 1 : 0) + q.stars.length + q.amenities.length;
}

/** « Tout réinitialiser » : garde destination, dates et voyageurs (miroir `clearedFilters`). */
export function clearedFilters(q: HotelSearchQuery): HotelSearchQuery {
  return { ...q, minPrice: null, maxPrice: null, stars: [], amenities: [], sort: "recommended" };
}

/** Brouillon de réservation lu dans l'URL. `null` si l'hôtel ou les dates manquent. */
export function parseBookingDraft(source: ParamSource): BookingDraft | null {
  const hotelId = read(source, "hotel");
  const checkIn = read(source, "in");
  const checkOut = read(source, "out");
  if (!isUuid(hotelId) || !isSqlDate(checkIn) || !isSqlDate(checkOut)) return null;
  const room = read(source, "room");
  const serviceIds = Array.from(
    new Set((read(source, "s") ?? "").split(",").map((s) => s.trim()).filter(isUuid)),
  ).slice(0, 30);
  return {
    hotelId,
    checkIn,
    checkOut,
    ...readGuests(source),
    roomId: isUuid(room) ? room : null,
    serviceIds,
  };
}

export type BookingStep = "rooms" | "services" | "checkout";

export function draftHref(step: BookingStep, draft: BookingDraft, overrides: Partial<BookingDraft> = {}): string {
  const d = { ...draft, ...overrides };
  const p = new URLSearchParams();
  p.set("hotel", d.hotelId);
  p.set("in", d.checkIn);
  p.set("out", d.checkOut);
  p.set("r", String(d.rooms));
  p.set("a", String(d.adults));
  p.set("c", String(d.children));
  if (d.roomId && step !== "rooms") p.set("room", d.roomId);
  if (d.serviceIds.length) p.set("s", d.serviceIds.join(","));
  return `/hotels/booking/${step}?${p.toString()}`;
}

/** Lien de connexion qui ramène EXACTEMENT ici (chemin + brouillon). */
export function loginHref(currentPathWithQuery: string): string {
  return `/auth/login?next=${encodeURIComponent(currentPathWithQuery)}`;
}
