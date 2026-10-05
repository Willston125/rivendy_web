/**
 * 🏨 CATALOGUE HÔTELIER — LECTURE SEULE.
 *
 * Miroir de `rivendy_app/lib/features/hotels/services/hotel_service.dart`.
 * Chaque fonction reçoit son client Supabase : le navigateur passe
 * `supabase` (`@/lib/supabase/client`), le rendu serveur passe
 * `createAnonServerClient()`. Ce module n'importe ni l'un ni l'autre.
 *
 * ⚠️ Rien ici ne crée ni ne modifie une réservation (voir `booking.ts`).
 * ⚠️ Aucun prix n'est FACTURÉ d'ici : les tarifs remontés servent à peindre
 *    un « à partir de » ; le montant vient toujours de `hotel_quote`.
 *
 * Différence assumée avec l'app : une erreur réseau LÈVE (`HotelDataError`)
 * au lieu de renvoyer une liste vide. Une liste vide et une API morte ne
 * se ressemblent pas — l'écran doit pouvoir afficher « Réessayer ».
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nightsOfStay, fitsCapacity, isStayAvailable, previewRoomSubtotal } from "./availability";
import {
  parseAmenity,
  parseHotel,
  parsePaymentOption,
  parseReview,
  parseRoom,
  parseService,
  ratingBreakdown,
  type Hotel,
  type HotelAmenity,
  type HotelListing,
  type HotelPaymentOption,
  type HotelRatingBreakdown,
  type HotelReview,
  type HotelRoom,
  type HotelServiceItem,
  type InventoryByDate,
  type RateByDate,
} from "./types";
import type { HotelSearchQuery, HotelSort } from "./search-params";

export class HotelDataError extends Error {
  constructor(context: string, cause?: unknown) {
    super(`${context}: ${cause instanceof Error ? cause.message : String((cause as { message?: string })?.message ?? cause ?? "erreur")}`);
    this.name = "HotelDataError";
  }
}

const HOTEL_SELECT = "*, hotel_images(id, url, category, position, is_cover), hotel_amenity_links(amenity_code)";
const ROOM_SELECT =
  "id, hotel_id, name, description, capacity_adults, capacity_children, bed_configuration, size_sqm, base_price, currency, hotel_room_images(url, position)";

/** Taille de page PostgREST (max-rows Supabase = 1000 par défaut). */
const PAGE = 1000;

/**
 * Lit TOUTES les lignes d'une requête, par pages de 1000.
 *
 * ⚠️ Sans cela, PostgREST tronque EN SILENCE à 1000 lignes : vingt hôtels ×
 * cinq chambres × trente nuits = 3000 lignes d'inventaire, dont les deux
 * tiers disparaîtraient — et des nuits « manquantes » comptent pour 0.
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  context: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new HotelDataError(context, error);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Neutralise les caractères qui ont un sens dans la syntaxe PostgREST
 * `.or()` ou dans un motif LIKE. Sans cela, taper « % » remonterait tout le
 * catalogue et une virgule casserait le filtre.
 */
export function sanitizeDestination(input: string): string {
  return input.replace(/[%_,()*"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

// ══════════════════════════════════════════════════════════════════════
// RECHERCHE
// ══════════════════════════════════════════════════════════════════════

/**
 * Une page d'hôtels du marché, filtrés côté SERVEUR sur la destination
 * (ilike ville/région/nom) et le classement. Le reste (budget, équipements,
 * disponibilité) est affiné par `enrichListings` + `applyLocalFilters`.
 *
 * L'ordre est stable (id en dernier critère) : sans lui, deux pages
 * successives pourraient se recouvrir ou sauter un hôtel.
 */
export async function searchHotels(
  client: SupabaseClient,
  query: Pick<HotelSearchQuery, "destination" | "stars">,
  { countryId, offset, limit }: { countryId: string; offset: number; limit: number },
): Promise<Hotel[]> {
  let request = client.from("visible_hotels").select(HOTEL_SELECT).eq("country_id", countryId);
  const term = sanitizeDestination(query.destination);
  if (term) {
    request = request.or(`city.ilike.%${term}%,region.ilike.%${term}%,name.ilike.%${term}%`);
  }
  if (query.stars.length) request = request.in("star_rating", query.stars);
  const { data, error } = await request
    .order("is_verified", { ascending: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new HotelDataError("searchHotels", error);
  return (data ?? []).map((r) => parseHotel(r as Record<string, unknown>));
}

export async function getHotelById(client: SupabaseClient, hotelId: string): Promise<Hotel | null> {
  const { data, error } = await client.from("visible_hotels").select(HOTEL_SELECT).eq("id", hotelId).maybeSingle();
  if (error) throw new HotelDataError("getHotelById", error);
  return data ? parseHotel(data as Record<string, unknown>) : null;
}

/** Destinations dérivées des hôtels RÉELLEMENT publiés du marché — aucune liste en dur. */
export async function getMarketDestinations(
  client: SupabaseClient,
  countryId: string,
): Promise<{ city: string; count: number; cover: string }[]> {
  const rows = await fetchAll<Record<string, unknown>>(
    (from, to) =>
      client
        .from("visible_hotels")
        .select("id, city, hotel_images(url, position, is_cover)")
        .eq("country_id", countryId)
        .order("id")
        .range(from, to),
    "getMarketDestinations",
  );
  const byCity = new Map<string, { count: number; cover: string }>();
  for (const r of rows) {
    const hotel = parseHotel(r);
    const city = hotel.city.trim();
    if (!city) continue;
    const entry = byCity.get(city) ?? { count: 0, cover: "" };
    entry.count += 1;
    if (!entry.cover) entry.cover = hotel.images.find((i) => i.isCover)?.url ?? hotel.images[0]?.url ?? "";
    byCity.set(city, entry);
  }
  return Array.from(byCity.entries())
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "fr"))
    .slice(0, 6);
}

// ══════════════════════════════════════════════════════════════════════
// CHAMBRES, INVENTAIRE, TARIFS, SERVICES, PAIEMENT
// ══════════════════════════════════════════════════════════════════════

export async function getRooms(client: SupabaseClient, hotelId: string): Promise<HotelRoom[]> {
  const { data, error } = await client
    .from("hotel_rooms")
    .select(ROOM_SELECT)
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("base_price", { ascending: true });
  if (error) throw new HotelDataError("getRooms", error);
  return (data ?? []).map((r) => parseRoom(r as Record<string, unknown>));
}

/** Chambres actives de PLUSIEURS hôtels en une requête (pas de N+1). */
export async function getRoomsForHotels(client: SupabaseClient, hotelIds: string[]): Promise<Map<string, HotelRoom[]>> {
  const byHotel = new Map<string, HotelRoom[]>();
  if (hotelIds.length === 0) return byHotel;
  const rows = await fetchAll<Record<string, unknown>>(
    (from, to) =>
      client
        .from("hotel_rooms")
        .select(ROOM_SELECT)
        .in("hotel_id", hotelIds)
        .eq("is_active", true)
        .order("base_price", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "getRoomsForHotels",
  );
  for (const r of rows) {
    const room = parseRoom(r);
    const list = byHotel.get(room.hotelId) ?? [];
    list.push(room);
    byHotel.set(room.hotelId, list);
  }
  return byHotel;
}

/**
 * Inventaire ET tarifs de plusieurs chambres sur une période, indexés par
 * chambre puis par date `AAAA-MM-JJ`. Deux requêtes pour toutes les chambres.
 *
 * Les tarifs sont rendus À PART de l'inventaire (l'app ne les garde que pour
 * les nuits qui ont une ligne d'inventaire et ignore un tarif à 0) : ici on
 * suit à la lettre le `COALESCE(rt.price, base_price)` de `hotel_quote`.
 */
export async function getInventory(
  client: SupabaseClient,
  { roomIds, from, to }: { roomIds: string[]; from: string; to: string },
): Promise<{ inventory: Map<string, InventoryByDate>; rates: Map<string, RateByDate> }> {
  const inventory = new Map<string, InventoryByDate>();
  const rates = new Map<string, RateByDate>();
  if (roomIds.length === 0) return { inventory, rates };

  const [invRows, rateRows] = await Promise.all([
    fetchAll<Record<string, unknown>>(
      (a, b) =>
        client
          .from("hotel_room_inventory")
          .select("room_id, date, total_rooms, booked_rooms, available_rooms")
          .in("room_id", roomIds)
          .gte("date", from)
          .lte("date", to)
          .order("room_id")
          .order("date")
          .range(a, b),
      "getInventory",
    ),
    fetchAll<Record<string, unknown>>(
      (a, b) =>
        client
          .from("hotel_room_rates")
          .select("room_id, date, price")
          .in("room_id", roomIds)
          .gte("date", from)
          .lte("date", to)
          .order("room_id")
          .order("date")
          .range(a, b),
      "getRates",
    ),
  ]);

  for (const r of invRows) {
    const roomId = String(r.room_id);
    const date = String(r.date).slice(0, 10);
    const byDate = inventory.get(roomId) ?? {};
    byDate[date] = {
      date,
      totalRooms: Number(r.total_rooms ?? 0),
      bookedRooms: Number(r.booked_rooms ?? 0),
      // Colonne GÉNÉRÉE en base : on la lit, on ne la recalcule jamais.
      availableRooms: Number(r.available_rooms ?? 0),
    };
    inventory.set(roomId, byDate);
  }
  for (const r of rateRows) {
    const roomId = String(r.room_id);
    const price = Number(r.price);
    if (!Number.isFinite(price)) continue;
    const byDate = rates.get(roomId) ?? {};
    byDate[String(r.date).slice(0, 10)] = price;
    rates.set(roomId, byDate);
  }
  return { inventory, rates };
}

export async function getServices(client: SupabaseClient, hotelId: string): Promise<HotelServiceItem[]> {
  const { data, error } = await client
    .from("hotel_services")
    .select("id, hotel_id, name, description, price, unit, icon, image_url")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) throw new HotelDataError("getServices", error);
  return (data ?? []).map((r) => parseService(r as Record<string, unknown>));
}

/** Moyens de paiement ACTIVÉS pour cet établissement (`is_enabled = true`). */
export async function getPaymentOptions(client: SupabaseClient, hotelId: string): Promise<HotelPaymentOption[]> {
  const { data, error } = await client
    .from("hotel_payment_options")
    .select("method_code, collection_model")
    .eq("hotel_id", hotelId)
    .eq("is_enabled", true);
  if (error) throw new HotelDataError("getPaymentOptions", error);
  return (data ?? []).map((r) => parsePaymentOption(r as Record<string, unknown>)).filter((o) => o.methodCode);
}

/** Référentiel d'équipements (en base : ajouter « Hammam » ne demande aucun déploiement). */
export async function getAmenityReferential(client: SupabaseClient): Promise<HotelAmenity[]> {
  const { data, error } = await client
    .from("hotel_amenities")
    .select("code, label_fr, icon, category, position")
    .eq("is_active", true)
    .order("position", { ascending: true });
  if (error) throw new HotelDataError("getAmenityReferential", error);
  return (data ?? []).map((r) => parseAmenity(r as Record<string, unknown>));
}

// ══════════════════════════════════════════════════════════════════════
// AVIS
// ══════════════════════════════════════════════════════════════════════

const RATING_COLS = "rating, rating_cleanliness, rating_location, rating_service, rating_comfort, rating_value";

/**
 * Moyenne sur TOUS les avis de l'hôtel + les plus récents avec leur auteur.
 *
 * L'app calcule la moyenne sur les 20 derniers avis chargés seulement ; ici
 * la répartition porte sur la totalité. Les noms viennent de la jointure
 * `profiles(full_name)` ; si la base refuse la jointure, les avis restent
 * affichés, signés « Voyageur vérifié ».
 */
export async function getHotelReviews(
  client: SupabaseClient,
  hotelId: string,
  recentLimit = 10,
): Promise<{ breakdown: HotelRatingBreakdown; recent: HotelReview[] }> {
  const all = await fetchAll<Record<string, unknown>>(
    (from, to) => client.from("hotel_reviews").select(`id, ${RATING_COLS}`).eq("hotel_id", hotelId).order("id").range(from, to),
    "getHotelReviews",
  );
  const breakdown = ratingBreakdown(all.map((r) => parseReview(r)));
  if (all.length === 0) return { breakdown, recent: [] };

  const base = `id, booking_id, ${RATING_COLS}, comment, created_at`;
  const recentQuery = (columns: string) =>
    client
      .from("hotel_reviews")
      .select(columns)
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(recentLimit);
  let result = await recentQuery(`${base}, profiles(full_name)`);
  if (result.error) result = await recentQuery(base);
  if (result.error) throw new HotelDataError("getHotelReviews(recent)", result.error);
  const recentRows = (result.data ?? []) as unknown as Record<string, unknown>[];
  return { breakdown, recent: recentRows.map((r) => parseReview(r)) };
}

/** Note moyenne et nombre d'avis de plusieurs hôtels, en une requête paginée. */
export async function getRatingsForHotels(
  client: SupabaseClient,
  hotelIds: string[],
): Promise<Map<string, { average: number; count: number }>> {
  const out = new Map<string, { average: number; count: number }>();
  if (hotelIds.length === 0) return out;
  const rows = await fetchAll<Record<string, unknown>>(
    (from, to) => client.from("hotel_reviews").select("id, hotel_id, rating").in("hotel_id", hotelIds).order("id").range(from, to),
    "getRatingsForHotels",
  );
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const id = String(r.hotel_id);
    const a = acc.get(id) ?? { sum: 0, count: 0 };
    a.sum += Number(r.rating ?? 0);
    a.count += 1;
    acc.set(id, a);
  }
  acc.forEach((v, k) => out.set(k, { average: v.sum / v.count, count: v.count }));
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// RÉSULTATS : PRIX « À PARTIR DE », DISPONIBILITÉ, FILTRES, TRI
// ══════════════════════════════════════════════════════════════════════

/**
 * Miroir de `HotelSearchProvider._withPricingAndAvailability` : ajoute le
 * prix « à partir de » et écarte les hôtels qui ne peuvent pas accueillir
 * le séjour (capacité, et disponibilité sur TOUTES les nuits si des dates
 * sont posées). Trois requêtes groupées pour toute la page, jamais une par
 * hôtel. Ajoute la note réelle (absente des résultats de l'app).
 */
export async function enrichListings(
  client: SupabaseClient,
  hotels: Hotel[],
  query: Pick<HotelSearchQuery, "checkIn" | "checkOut" | "rooms" | "adults" | "children">,
): Promise<HotelListing[]> {
  if (hotels.length === 0) return [];
  const ids = hotels.map((h) => h.id);
  const [roomsByHotel, ratings] = await Promise.all([getRoomsForHotels(client, ids), getRatingsForHotels(client, ids)]);

  const allRoomIds = Array.from(roomsByHotel.values()).flatMap((rooms) => rooms.map((r) => r.id));
  if (allRoomIds.length === 0) return [];

  const nights = query.checkIn && query.checkOut ? nightsOfStay(query.checkIn, query.checkOut) : [];
  const hasDates = nights.length > 0;
  const { inventory, rates } = hasDates
    ? await getInventory(client, { roomIds: allRoomIds, from: nights[0], to: nights[nights.length - 1] })
    : { inventory: new Map<string, InventoryByDate>(), rates: new Map<string, RateByDate>() };

  const out: HotelListing[] = [];
  for (const hotel of hotels) {
    const rooms = roomsByHotel.get(hotel.id) ?? [];
    if (rooms.length === 0) continue;

    let minPrice: number | null = null;
    for (const room of rooms) {
      if (!fitsCapacity({ room, adults: query.adults, children: query.children, roomsCount: query.rooms })) continue;
      if (hasDates) {
        const byDate = inventory.get(room.id) ?? {};
        if (!isStayAvailable({ nights, inventoryByDate: byDate, roomsWanted: query.rooms })) continue;
        const subtotal = previewRoomSubtotal({
          nights,
          rateByDate: rates.get(room.id) ?? {},
          basePrice: room.basePrice,
          roomsCount: 1,
        });
        const perNight = subtotal / nights.length;
        if (minPrice == null || perNight < minPrice) minPrice = perNight;
      } else if (minPrice == null || room.basePrice < minPrice) {
        minPrice = room.basePrice;
      }
    }
    // Aucune chambre ne convient : l'hôtel n'a rien à faire dans ces résultats.
    if (minPrice == null) continue;

    const rating = ratings.get(hotel.id);
    out.push({
      ...hotel,
      minPrice,
      currency: rooms[0].currency,
      averageRating: rating ? rating.average : null,
      reviewCount: rating?.count ?? 0,
    });
  }
  return out;
}

/** Budget et équipements, appliqués côté client comme dans l'app (`_applyLocalFilters`). */
export function applyLocalFilters(
  listings: HotelListing[],
  query: Pick<HotelSearchQuery, "minPrice" | "maxPrice" | "amenities">,
): HotelListing[] {
  return listings.filter((h) => {
    if (query.minPrice != null && h.minPrice < query.minPrice) return false;
    if (query.maxPrice != null && h.minPrice > query.maxPrice) return false;
    if (query.amenities.length) {
      const owned = new Set(h.amenityCodes);
      if (!query.amenities.every((c) => owned.has(c))) return false;
    }
    return true;
  });
}

/** Tri — miroir de `_sortInPlace`. « Mieux notés » ne s'applique qu'avec de vraies notes. */
export function sortListings(listings: HotelListing[], sort: HotelSort): HotelListing[] {
  const sorted = [...listings];
  const rating = (h: HotelListing) => h.averageRating ?? 0;
  switch (sort) {
    case "price_asc":
      sorted.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.minPrice - a.minPrice);
      break;
    case "rating_desc":
      sorted.sort((a, b) => rating(b) - rating(a) || b.reviewCount - a.reviewCount);
      break;
    case "recommended":
    default:
      // Partenaires vérifiés d'abord, puis la note.
      sorted.sort((a, b) => (a.isVerified !== b.isVerified ? (a.isVerified ? -1 : 1) : rating(b) - rating(a)));
  }
  return sorted;
}

// ══════════════════════════════════════════════════════════════════════
// FAVORIS — table DÉDIÉE `hotel_favorites` (la table `favorites` vise des products)
// ══════════════════════════════════════════════════════════════════════

/** Aucun filtre `user_id` : la policy `hotel_favorites_own` s'en charge. */
export async function getFavoriteHotelIds(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client.from("hotel_favorites").select("hotel_id");
  if (error) throw new HotelDataError("getFavoriteHotelIds", error);
  return new Set((data ?? []).map((r) => String((r as { hotel_id: unknown }).hotel_id)).filter(Boolean));
}

/** Ajoute (upsert, un double clic ne lève pas de doublon) ou retire un favori. */
export async function setHotelFavorite(
  client: SupabaseClient,
  { userId, hotelId, add }: { userId: string; hotelId: string; add: boolean },
): Promise<boolean> {
  if (add) {
    const { error } = await client
      .from("hotel_favorites")
      .upsert({ user_id: userId, hotel_id: hotelId }, { onConflict: "user_id,hotel_id" });
    return !error;
  }
  const { error } = await client.from("hotel_favorites").delete().eq("user_id", userId).eq("hotel_id", hotelId);
  return !error;
}
