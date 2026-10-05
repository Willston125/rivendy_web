/**
 * 🧾 RÉSERVATION — tout ce qui engage. Miroir de
 * `rivendy_app/lib/features/hotels/services/hotel_booking_service.dart`.
 *
 * Signatures relevées dans
 * `rivendy_dashboard/supabase/migrations/20260824_hotels_booking_rpc.sql`
 * (fichier propriétaire unique des fonctions `hotel_*`) :
 *
 *   hotel_quote(p_room_id uuid, p_check_in date, p_check_out date,
 *               p_adults smallint, p_children smallint, p_rooms_count smallint,
 *               p_service_ids uuid[])                       → jsonb   (anon, authenticated)
 *   hotel_create_booking(…mêmes 7…, p_guest_name text, p_guest_phone text,
 *               p_guest_email text, p_payment_method text,
 *               p_expected_total numeric)                   → jsonb   (authenticated)
 *   hotel_cancel_booking(p_booking_id uuid, p_reason text)  → jsonb   (authenticated)
 *   hotel_add_service_to_booking(p_booking_id uuid, p_service_id uuid) → jsonb
 *
 * ⚠️ AUCUNE écriture directe dans `hotel_bookings` : la table n'a aucune
 *    policy INSERT pour `authenticated`, et c'est voulu. Seules les RPC
 *    créent, annulent ou complètent une réservation.
 * ⚠️ AUCUN total n'est calculé ici. `expectedTotal` est le total du DERNIER
 *    devis serveur ; la RPC s'en sert pour signaler une dérive d'affichage,
 *    jamais pour facturer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseBooking,
  parseBookingResult,
  parseErrorCode,
  parseQuote,
  type HotelBooking,
  type HotelBookingResult,
  type HotelErrorCode,
  type HotelQuote,
} from "./types";
import { HotelDataError } from "./catalog";

export interface StayRequest {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomsCount: number;
  serviceIds: string[];
}

function stayParams(s: StayRequest) {
  return {
    p_room_id: s.roomId,
    p_check_in: s.checkIn,
    p_check_out: s.checkOut,
    p_adults: s.adults,
    p_children: s.children,
    p_rooms_count: s.roomsCount,
    p_service_ids: s.serviceIds,
  };
}

/** Devis calculé par le SERVEUR. Seule source des montants affichés. */
export async function requestQuote(client: SupabaseClient, stay: StayRequest): Promise<HotelQuote> {
  try {
    const { data, error } = await client.rpc("hotel_quote", stayParams(stay));
    if (error) return { ok: false, error: "network" };
    return parseQuote(data);
  } catch {
    return { ok: false, error: "network" };
  }
}

/**
 * Réservation ferme. La RPC relit l'inventaire SOUS VERROU, recalcule tout
 * et renvoie `room_unavailable` (avec la nuit fautive) si la chambre est
 * partie entre-temps.
 */
export async function createBooking(
  client: SupabaseClient,
  stay: StayRequest,
  extra: {
    guestName: string;
    guestPhone: string;
    guestEmail: string | null;
    paymentMethod: string | null;
    expectedTotal: number;
  },
): Promise<HotelBookingResult> {
  try {
    const { data, error } = await client.rpc("hotel_create_booking", {
      ...stayParams(stay),
      p_guest_name: extra.guestName,
      p_guest_phone: extra.guestPhone,
      p_guest_email: extra.guestEmail,
      p_payment_method: extra.paymentMethod,
      p_expected_total: extra.expectedTotal,
    });
    if (error) return { ok: false, error: "network", unavailableDate: null };
    const result = parseBookingResult(data);
    if (result.ok && result.clientTotalMismatch) {
      // Informatif : c'est TOUJOURS le montant serveur qui fait foi.
      console.warn("[Hotel] total affiché ≠ total serveur", { expected: extra.expectedTotal, billed: result.totalAmount });
    }
    return result;
  } catch {
    return { ok: false, error: "network", unavailableDate: null };
  }
}

/**
 * Colonnes énumérées : la commission (`commission_*`, `net_due_to_property`)
 * n'a rien à faire dans le navigateur du voyageur, même lisible par RLS.
 */
const BOOKING_SELECT = [
  "id, booking_reference, hotel_id, room_id, country_id, check_in, check_out, nights",
  "adults, children, rooms_count, room_subtotal, services_total, taxes_total, discount_total",
  "total_amount, currency, booking_status, payment_status, payment_method, payment_collection_model",
  "cancelled_at, created_at",
  "hotels(name, city, hotel_images(url, position, is_cover))",
  "hotel_rooms(name)",
  "hotel_booking_services(id, service_id, name_snapshot, unit_snapshot, unit_price, quantity, line_total, added_after_booking, created_at)",
  "hotel_booking_guests(full_name, phone, email, is_primary)",
].join(", ");

/** Réservations de l'utilisateur connecté. Aucun filtre `user_id` : la policy RLS s'en charge. */
export async function getMyBookings(client: SupabaseClient): Promise<HotelBooking[]> {
  const { data, error } = await client
    .from("hotel_bookings")
    .select(BOOKING_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new HotelDataError("getMyBookings", error);
  return (data ?? []).map((r) => parseBooking(r as unknown as Record<string, unknown>));
}

export async function getBookingById(client: SupabaseClient, bookingId: string): Promise<HotelBooking | null> {
  const { data, error } = await client.from("hotel_bookings").select(BOOKING_SELECT).eq("id", bookingId).maybeSingle();
  if (error) throw new HotelDataError("getBookingById", error);
  return data ? parseBooking(data as unknown as Record<string, unknown>) : null;
}

export async function getBookingByReference(client: SupabaseClient, reference: string): Promise<HotelBooking | null> {
  const { data, error } = await client
    .from("hotel_bookings")
    .select(BOOKING_SELECT)
    .eq("booking_reference", reference)
    .maybeSingle();
  if (error) throw new HotelDataError("getBookingByReference", error);
  return data ? parseBooking(data as unknown as Record<string, unknown>) : null;
}

export type RpcOutcome = { ok: true; refundPending?: boolean } | { ok: false; error: HotelErrorCode };

/** Annule ET rend l'inventaire (RPC). Le remboursement éventuel n'est pas traité ici. */
export async function cancelBooking(client: SupabaseClient, bookingId: string, reason: string): Promise<RpcOutcome> {
  try {
    const { data, error } = await client.rpc("hotel_cancel_booking", { p_booking_id: bookingId, p_reason: reason });
    if (error) return { ok: false, error: "network" };
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === true) return { ok: true, refundPending: r.refund_pending === true };
    return { ok: false, error: parseErrorCode(r.error) };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Ajoute un service après coup. Le montant est recalculé par la RPC, jamais ici. */
export async function addServiceToBooking(client: SupabaseClient, bookingId: string, serviceId: string): Promise<RpcOutcome> {
  try {
    const { data, error } = await client.rpc("hotel_add_service_to_booking", {
      p_booking_id: bookingId,
      p_service_id: serviceId,
    });
    if (error) return { ok: false, error: "network" };
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === true) return { ok: true };
    return { ok: false, error: parseErrorCode(r.error) };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Vrai si un avis existe déjà pour ce séjour (UNIQUE(booking_id)). */
export async function hasReviewForBooking(client: SupabaseClient, bookingId: string): Promise<boolean> {
  const { data, error } = await client.from("hotel_reviews").select("id").eq("booking_id", bookingId).maybeSingle();
  if (error) throw new HotelDataError("hasReviewForBooking", error);
  return !!data;
}

export type ReviewOutcome = { ok: true } | { ok: false; reason: "duplicate" | "refused" | "network" };

/**
 * Publie un avis VÉRIFIÉ. La règle (réservation de l'utilisateur, séjour
 * `completed`) est imposée par la policy `hotel_reviews_verified_insert` ;
 * `UNIQUE(booking_id)` limite à un avis par séjour. Le contrôle d'interface
 * n'est que du confort.
 */
export async function submitReview(
  client: SupabaseClient,
  input: {
    userId: string;
    bookingId: string;
    hotelId: string;
    rating: number;
    comment: string;
    cleanliness: number | null;
    location: number | null;
    service: number | null;
    comfort: number | null;
    value: number | null;
  },
): Promise<ReviewOutcome> {
  const row: Record<string, unknown> = {
    booking_id: input.bookingId,
    hotel_id: input.hotelId,
    user_id: input.userId,
    rating: input.rating,
  };
  const comment = input.comment.trim();
  if (comment) row.comment = comment.slice(0, 800);
  if (input.cleanliness != null) row.rating_cleanliness = input.cleanliness;
  if (input.location != null) row.rating_location = input.location;
  if (input.service != null) row.rating_service = input.service;
  if (input.comfort != null) row.rating_comfort = input.comfort;
  if (input.value != null) row.rating_value = input.value;
  try {
    const { error } = await client.from("hotel_reviews").insert(row);
    if (!error) return { ok: true };
    if (error.code === "23505") return { ok: false, reason: "duplicate" };
    if (error.code === "42501") return { ok: false, reason: "refused" };
    return { ok: false, reason: "network" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
