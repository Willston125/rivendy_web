import type { Product } from "@/types/rivendy";

/** Filtre "tout afficher". */
export const HOTEL_FILTER_ALL = "Tous";

/** Filtres d'ambiance (chips). */
export const HOTEL_FILTERS = [
  HOTEL_FILTER_ALL,
  "Vue mer",
  "Piscine",
  "Business",
  "Famille",
  "Couple",
  "Luxe",
  "Budget",
  "Proche aéroport",
  "Long séjour",
];

/** Vue agrégée d'un hôtel (= un vendeur). */
export interface HotelSummary {
  sellerId: string;
  sellerName: string;
  coverUrl: string;
  locality: string;
  amenities: string[];
  minPrice: number;
  roomCount: number;
  isVerified: boolean;
  hasPromo: boolean;
}

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[ôö]/g, "o")
    .replace(/[ûü]/g, "u")
    .replace(/[îï]/g, "i")
    .trim();
}

function split(raw: string): string[] {
  return raw
    .split(/[,;/]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export function hotelRoomPrice(p: Product): number {
  const v = attr(p, "prix_nuit").replace(/[^\d.]/g, "");
  const n = Number.parseFloat(v);
  if (Number.isFinite(n) && n > 0) return n;
  return p.price;
}

function roomTags(p: Product): string[] {
  return [...split(attr(p, "tags")), ...split(attr(p, "equipements"))];
}

function matchesFilter(rooms: Product[], filter: string): boolean {
  if (filter === HOTEL_FILTER_ALL) return true;
  const f = norm(filter);
  return rooms.some((p) =>
    roomTags(p).some((t) => {
      const nt = norm(t);
      return nt.includes(f) || f.includes(nt);
    }),
  );
}

/** Regroupe les chambres par hôtel et applique `filter`. */
export function groupHotels(products: Product[], filter: string = HOTEL_FILTER_ALL): HotelSummary[] {
  const bySeller = new Map<string, Product[]>();
  const order: string[] = [];
  for (const p of products) {
    const key = p.seller_id ? p.seller_id : (p.seller_name ?? "");
    if (!bySeller.has(key)) order.push(key);
    const list = bySeller.get(key) ?? [];
    list.push(p);
    bySeller.set(key, list);
  }

  const hotels: HotelSummary[] = [];
  for (const key of order) {
    const rooms = bySeller.get(key)!;
    if (!matchesFilter(rooms, filter)) continue;
    const first = rooms[0];

    let minPrice = 0;
    for (const r of rooms) {
      const price = hotelRoomPrice(r);
      if (price > 0 && (minPrice === 0 || price < minPrice)) minPrice = price;
    }

    const amenities: string[] = [];
    for (const r of rooms) {
      for (const a of split(attr(r, "equipements"))) {
        if (!amenities.some((e) => norm(e) === norm(a))) amenities.push(a);
        if (amenities.length >= 4) break;
      }
      if (amenities.length >= 4) break;
    }

    let locality = "";
    let cover = "";
    for (const r of rooms) {
      if (!locality) locality = attr(r, "localisation") || attr(r, "zone") || attr(r, "ville");
      if (!cover && r.photos?.[0]) cover = r.photos[0];
    }

    hotels.push({
      sellerId: first.seller_id,
      sellerName: first.seller_name ?? "",
      coverUrl: cover,
      locality,
      amenities,
      minPrice,
      roomCount: rooms.length,
      isVerified: Boolean(first.seller_is_certified),
      hasPromo: rooms.some((p) => p.status === "boosted"),
    });
  }
  return hotels;
}
