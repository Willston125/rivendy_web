/**
 * 🏨 MODÈLES DU DOMAINE HÔTELIER — miroir de `rivendy_app/lib/features/hotels/models/*`.
 *
 * Domaine À PART ENTIÈRE (PROTECTED_ZONES §1.11) : un hôtel n'est ni un
 * vendeur ni un `Product`. Les colonnes viennent de
 * `rivendy_dashboard/supabase/migrations/20260824_hotels_core_schema.sql`.
 *
 * ⚠️ Tous les montants d'une réservation ou d'un devis viennent du SERVEUR.
 * Aucune fonction de ce fichier ne recalcule un total : elles recopient.
 *
 * ⚠️ La commission (`commission_amount`, `commission_rate`,
 * `net_due_to_property`) n'est volontairement PAS portée par ces types :
 * elle ne regarde pas le voyageur et ne doit jamais s'afficher.
 */

import { hhmm } from "./dates";

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0) => {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const optNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Row[]) : []);
const one = (v: unknown): Row | null => {
  if (Array.isArray(v)) return (v[0] as Row) ?? null;
  return v && typeof v === "object" ? (v as Row) : null;
};

// ══════════════════════════════════════════════════════════════════════
// ÉTABLISSEMENT
// ══════════════════════════════════════════════════════════════════════

export type HotelImageCategory =
  | "exterieur" | "chambres" | "piscine" | "restaurant"
  | "reception" | "salle_de_bain" | "vue" | "autres";

export interface HotelImage {
  id: string;
  url: string;
  category: HotelImageCategory;
  position: number;
  isCover: boolean;
}

export interface HotelAmenity {
  code: string;
  label: string;
  /** Nom d'icône Material du référentiel — résolu à l'affichage. */
  icon: string;
  category: string;
  position: number;
}

export interface Hotel {
  id: string;
  countryId: string;
  name: string;
  slug: string;
  description: string;
  /** Classement 1–5, `null` si NON CLASSÉ (≠ « 0 étoile » : ne rien afficher). */
  starRating: number | null;
  address: string;
  city: string;
  region: string;
  checkInTime: string;
  checkOutTime: string;
  isVerified: boolean;
  isAcceptingBookings: boolean;
  images: HotelImage[];
  amenityCodes: string[];
}

/** Hôtel enrichi pour une liste de résultats (prix et note dérivés). */
export interface HotelListing extends Hotel {
  /** Prix « à partir de » par nuit — APERÇU, jamais facturé. */
  minPrice: number;
  currency: string;
  averageRating: number | null;
  reviewCount: number;
}

const IMAGE_CATEGORIES: HotelImageCategory[] = [
  "exterieur", "chambres", "piscine", "restaurant", "reception", "salle_de_bain", "vue", "autres",
];

export function parseHotelImage(r: Row): HotelImage {
  const cat = str(r.category) as HotelImageCategory;
  return {
    id: str(r.id),
    url: str(r.url),
    category: IMAGE_CATEGORIES.includes(cat) ? cat : "autres",
    position: num(r.position),
    isCover: bool(r.is_cover),
  };
}

export function parseAmenity(r: Row): HotelAmenity {
  return {
    code: str(r.code),
    label: str(r.label_fr, str(r.code)),
    icon: str(r.icon),
    category: str(r.category, "general"),
    position: num(r.position),
  };
}

/** Ligne de `visible_hotels` + jointures `hotel_images`, `hotel_amenity_links`. */
export function parseHotel(r: Row): Hotel {
  const images = rows(r.hotel_images)
    .map(parseHotelImage)
    .filter((i) => i.url)
    .sort((a, b) => a.position - b.position);
  const amenityCodes = Array.from(
    new Set(rows(r.hotel_amenity_links).map((l) => str(l.amenity_code)).filter(Boolean)),
  );
  return {
    id: str(r.id),
    countryId: str(r.country_id),
    name: str(r.name),
    slug: str(r.slug),
    description: str(r.description),
    starRating: optNum(r.star_rating),
    address: str(r.address),
    city: str(r.city),
    region: str(r.region),
    checkInTime: hhmm(r.check_in_time, "14:00"),
    checkOutTime: hhmm(r.check_out_time, "11:00"),
    isVerified: bool(r.is_verified),
    isAcceptingBookings: bool(r.is_accepting_bookings, true),
    images,
    amenityCodes,
  };
}

/** Couverture : la photo `is_cover`, sinon la première. Vide si aucune photo. */
export function hotelCoverUrl(hotel: Pick<Hotel, "images">): string {
  return hotel.images.find((i) => i.isCover)?.url ?? hotel.images[0]?.url ?? "";
}

/** « Moroni · Bord de mer », ou l'un des deux. */
export function hotelLocationLabel(hotel: Pick<Hotel, "city" | "region">): string {
  return [hotel.city, hotel.region].map((s) => s.trim()).filter(Boolean).join(" · ");
}

// ══════════════════════════════════════════════════════════════════════
// CHAMBRES, INVENTAIRE, SERVICES, PAIEMENT
// ══════════════════════════════════════════════════════════════════════

export interface HotelRoom {
  id: string;
  hotelId: string;
  name: string;
  description: string;
  capacityAdults: number;
  capacityChildren: number;
  bedConfiguration: string;
  sizeSqm: number | null;
  /** Tarif de repli — affichage « à partir de » uniquement. */
  basePrice: number;
  currency: string;
  photos: string[];
}

export function parseRoom(r: Row): HotelRoom {
  const photos = rows(r.hotel_room_images)
    .sort((a, b) => num(a.position) - num(b.position))
    .map((i) => str(i.url))
    .filter(Boolean);
  return {
    id: str(r.id),
    hotelId: str(r.hotel_id),
    name: str(r.name),
    description: str(r.description),
    capacityAdults: num(r.capacity_adults, 2),
    capacityChildren: num(r.capacity_children, 0),
    bedConfiguration: str(r.bed_configuration),
    sizeSqm: optNum(r.size_sqm),
    basePrice: num(r.base_price),
    currency: str(r.currency),
    photos,
  };
}

export function roomTotalCapacity(room: Pick<HotelRoom, "capacityAdults" | "capacityChildren">): number {
  return room.capacityAdults + room.capacityChildren;
}

/** « 2 voyageurs · 1 lit King · 32 m² » — segments vides omis (miroir app). */
export function roomSummaryLabel(room: HotelRoom): string {
  return [
    `${room.capacityAdults} voyageur${room.capacityAdults > 1 ? "s" : ""}`,
    room.bedConfiguration.trim(),
    room.sizeSqm != null ? `${room.sizeSqm} m²` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Une journée d'inventaire (`hotel_room_inventory`). `availableRooms` est générée en base. */
export interface RoomInventoryDay {
  date: string;
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
}

/** Inventaire indexé par date `AAAA-MM-JJ`. */
export type InventoryByDate = Record<string, RoomInventoryDay>;
/** Tarifs `hotel_room_rates` indexés par date `AAAA-MM-JJ`. */
export type RateByDate = Record<string, number>;

export type HotelServiceUnit = "sejour" | "nuit" | "personne" | "personne_nuit";

export interface HotelServiceItem {
  id: string;
  hotelId: string;
  name: string;
  description: string;
  price: number;
  unit: HotelServiceUnit;
  icon: string;
  imageUrl: string;
}

const UNITS: HotelServiceUnit[] = ["sejour", "nuit", "personne", "personne_nuit"];

export function parseServiceUnit(raw: unknown): HotelServiceUnit {
  const u = str(raw) as HotelServiceUnit;
  return UNITS.includes(u) ? u : "sejour";
}

export function parseService(r: Row): HotelServiceItem {
  return {
    id: str(r.id),
    hotelId: str(r.hotel_id),
    name: str(r.name),
    description: str(r.description),
    price: num(r.price),
    unit: parseServiceUnit(r.unit),
    icon: str(r.icon),
    imageUrl: str(r.image_url),
  };
}

export interface HotelPaymentOption {
  methodCode: string;
  collectionModel: "platform_collect" | "property_collect";
}

export function parsePaymentOption(r: Row): HotelPaymentOption {
  return {
    methodCode: str(r.method_code),
    collectionModel: str(r.collection_model) === "platform_collect" ? "platform_collect" : "property_collect",
  };
}

// ══════════════════════════════════════════════════════════════════════
// DEVIS — retour de la RPC `hotel_quote`
// ══════════════════════════════════════════════════════════════════════

export type HotelErrorCode =
  | "invalid_dates" | "past_date" | "room_not_found" | "bookings_closed"
  | "capacity_exceeded" | "room_unavailable" | "not_authenticated"
  | "booking_not_found" | "forbidden" | "not_cancellable" | "not_modifiable"
  | "service_not_found" | "network" | "unknown";

const KNOWN_ERRORS: HotelErrorCode[] = [
  "invalid_dates", "past_date", "room_not_found", "bookings_closed", "capacity_exceeded",
  "room_unavailable", "not_authenticated", "booking_not_found", "forbidden",
  "not_cancellable", "not_modifiable", "service_not_found",
];

export function parseErrorCode(raw: unknown): HotelErrorCode {
  const code = str(raw) as HotelErrorCode;
  return KNOWN_ERRORS.includes(code) ? code : "unknown";
}

export interface QuoteServiceLine {
  serviceId: string;
  name: string;
  unit: HotelServiceUnit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type HotelQuote =
  | { ok: false; error: HotelErrorCode }
  | {
      ok: true;
      hotelId: string;
      roomId: string;
      nights: number;
      roomsCount: number;
      currency: string;
      roomSubtotal: number;
      servicesTotal: number;
      taxesTotal: number;
      discountTotal: number;
      /** LE montant. Le seul qui puisse être affiché comme total et envoyé en `p_expected_total`. */
      totalAmount: number;
      services: QuoteServiceLine[];
      /** Chambres libres sur la nuit la plus contrainte (aperçu). */
      availableRooms: number;
      /** ⚠️ `ok: true` n'implique PAS la disponibilité : tester ce champ. */
      isAvailable: boolean;
    };

export function parseQuote(raw: unknown): HotelQuote {
  const r = one(raw);
  if (!r) return { ok: false, error: "unknown" };
  if (r.ok !== true) return { ok: false, error: parseErrorCode(r.error) };
  return {
    ok: true,
    hotelId: str(r.hotel_id),
    roomId: str(r.room_id),
    nights: num(r.nights),
    roomsCount: num(r.rooms_count, 1),
    currency: str(r.currency),
    roomSubtotal: num(r.room_subtotal),
    servicesTotal: num(r.services_total),
    taxesTotal: num(r.taxes_total),
    discountTotal: num(r.discount_total),
    totalAmount: num(r.total_amount),
    services: rows(r.services).map((s) => ({
      serviceId: str(s.service_id),
      name: str(s.name),
      unit: parseServiceUnit(s.unit),
      unitPrice: num(s.unit_price),
      quantity: num(s.quantity, 1),
      lineTotal: num(s.line_total),
    })),
    availableRooms: num(r.available_rooms),
    isAvailable: bool(r.is_available),
  };
}

export type HotelBookingResult =
  | { ok: false; error: HotelErrorCode; unavailableDate: string | null }
  | {
      ok: true;
      bookingId: string;
      reference: string;
      totalAmount: number;
      currency: string;
      clientTotalMismatch: boolean;
    };

export function parseBookingResult(raw: unknown): HotelBookingResult {
  const r = one(raw);
  if (!r) return { ok: false, error: "unknown", unavailableDate: null };
  if (r.ok !== true) {
    const d = r.unavailable_date == null ? null : str(r.unavailable_date).slice(0, 10);
    return { ok: false, error: parseErrorCode(r.error), unavailableDate: d };
  }
  return {
    ok: true,
    bookingId: str(r.booking_id),
    reference: str(r.booking_reference),
    totalAmount: num(r.total_amount),
    currency: str(r.currency),
    clientTotalMismatch: bool(r.client_total_mismatch),
  };
}

// ══════════════════════════════════════════════════════════════════════
// RÉSERVATION
// ══════════════════════════════════════════════════════════════════════

export type BookingStatus =
  | "pending" | "awaiting_payment" | "confirmed" | "checked_in"
  | "completed" | "cancelled" | "no_show";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

const BOOKING_STATUSES: BookingStatus[] = [
  "pending", "awaiting_payment", "confirmed", "checked_in", "completed", "cancelled", "no_show",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded", "partially_refunded"];

export interface HotelBookingServiceLine {
  id: string;
  serviceId: string | null;
  name: string;
  unit: HotelServiceUnit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  addedAfterBooking: boolean;
}

export interface HotelBookingGuest {
  fullName: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface HotelBooking {
  id: string;
  reference: string;
  hotelId: string;
  roomId: string;
  countryId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomsCount: number;
  roomSubtotal: number;
  servicesTotal: number;
  taxesTotal: number;
  discountTotal: number;
  totalAmount: number;
  currency: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  collectionModel: "platform_collect" | "property_collect";
  cancelledAt: string | null;
  createdAt: string;
  hotelName: string;
  hotelCity: string;
  hotelCoverUrl: string;
  roomName: string;
  services: HotelBookingServiceLine[];
  guests: HotelBookingGuest[];
}

export function parseBooking(r: Row): HotelBooking {
  const hotel = one(r.hotels);
  const room = one(r.hotel_rooms);
  const bs = str(r.booking_status) as BookingStatus;
  const ps = str(r.payment_status) as PaymentStatus;
  const hotelImages = hotel ? rows(hotel.hotel_images).map(parseHotelImage).sort((a, b) => a.position - b.position) : [];
  return {
    id: str(r.id),
    reference: str(r.booking_reference),
    hotelId: str(r.hotel_id),
    roomId: str(r.room_id),
    countryId: str(r.country_id),
    checkIn: str(r.check_in).slice(0, 10),
    checkOut: str(r.check_out).slice(0, 10),
    nights: num(r.nights, 1),
    adults: num(r.adults, 1),
    children: num(r.children, 0),
    roomsCount: num(r.rooms_count, 1),
    roomSubtotal: num(r.room_subtotal),
    servicesTotal: num(r.services_total),
    taxesTotal: num(r.taxes_total),
    discountTotal: num(r.discount_total),
    totalAmount: num(r.total_amount),
    currency: str(r.currency),
    bookingStatus: BOOKING_STATUSES.includes(bs) ? bs : "pending",
    paymentStatus: PAYMENT_STATUSES.includes(ps) ? ps : "pending",
    paymentMethod: str(r.payment_method),
    collectionModel: str(r.payment_collection_model) === "platform_collect" ? "platform_collect" : "property_collect",
    cancelledAt: r.cancelled_at == null ? null : str(r.cancelled_at),
    createdAt: str(r.created_at),
    hotelName: hotel ? str(hotel.name) : "",
    hotelCity: hotel ? str(hotel.city) : "",
    hotelCoverUrl: hotelImages.find((i) => i.isCover)?.url ?? hotelImages[0]?.url ?? "",
    roomName: room ? str(room.name) : "",
    services: rows(r.hotel_booking_services)
      .sort((a, b) => str(a.created_at).localeCompare(str(b.created_at)))
      .map((s) => ({
        id: str(s.id),
        serviceId: s.service_id == null ? null : str(s.service_id),
        name: str(s.name_snapshot),
        unit: parseServiceUnit(s.unit_snapshot),
        unitPrice: num(s.unit_price),
        quantity: num(s.quantity, 1),
        lineTotal: num(s.line_total),
        addedAfterBooking: bool(s.added_after_booking),
      })),
    guests: rows(r.hotel_booking_guests).map((g) => ({
      fullName: str(g.full_name),
      phone: str(g.phone),
      email: str(g.email),
      isPrimary: bool(g.is_primary),
    })),
  };
}

/** Onglet « À venir » — miroir de `BookingStatus.isUpcoming`. */
export function isUpcomingStatus(s: BookingStatus): boolean {
  return s === "pending" || s === "awaiting_payment" || s === "confirmed" || s === "checked_in";
}

/** Miroir de `BookingStatus.isCancellable` (l'app, plus stricte que la RPC). */
export function isCancellableStatus(s: BookingStatus): boolean {
  return s === "pending" || s === "awaiting_payment" || s === "confirmed";
}

/** Un service ne s'ajoute qu'à un séjour à venir ou en cours (même règle que la RPC). */
export function acceptsExtraServices(s: BookingStatus): boolean {
  return s === "confirmed" || s === "checked_in";
}

/** Seul un séjour RÉELLEMENT terminé ouvre le droit à un avis (policy RLS). */
export function allowsReview(s: BookingStatus): boolean {
  return s === "completed";
}

/** Contenu du QR : la RÉFÉRENCE seule, jamais de donnée personnelle (§1.11). */
export function bookingQrPayload(reference: string): string {
  return `RIVENDY:HOTEL:${reference}`;
}

// ══════════════════════════════════════════════════════════════════════
// AVIS
// ══════════════════════════════════════════════════════════════════════

export interface HotelReview {
  id: string;
  bookingId: string;
  rating: number;
  cleanliness: number | null;
  location: number | null;
  service: number | null;
  comfort: number | null;
  value: number | null;
  comment: string;
  createdAt: string;
  authorName: string;
}

export function parseReview(r: Row): HotelReview {
  const profile = one(r.profiles);
  return {
    id: str(r.id),
    bookingId: str(r.booking_id),
    rating: num(r.rating),
    cleanliness: optNum(r.rating_cleanliness),
    location: optNum(r.rating_location),
    service: optNum(r.rating_service),
    comfort: optNum(r.rating_comfort),
    value: optNum(r.rating_value),
    comment: str(r.comment),
    createdAt: str(r.created_at),
    authorName: profile ? str(profile.full_name) : "",
  };
}

export interface HotelRatingBreakdown {
  average: number;
  count: number;
  cleanliness: number | null;
  location: number | null;
  service: number | null;
  comfort: number | null;
  value: number | null;
}

export const EMPTY_BREAKDOWN: HotelRatingBreakdown = {
  average: 0, count: 0, cleanliness: null, location: null, service: null, comfort: null, value: null,
};

/**
 * Répartition calculée sur TOUS les avis reçus (l'app ne la calcule que sur
 * les 20 derniers chargés). Les sous-notes absentes sont ignorées, jamais
 * comptées comme des zéros — miroir de `HotelRatingBreakdown.fromReviews`.
 */
export function ratingBreakdown(
  reviews: Pick<HotelReview, "rating" | "cleanliness" | "location" | "service" | "comfort" | "value">[],
): HotelRatingBreakdown {
  if (reviews.length === 0) return EMPTY_BREAKDOWN;
  const avgOf = (pick: (r: (typeof reviews)[number]) => number | null) => {
    const values = reviews.map(pick).filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  return {
    average: reviews.reduce((a, r) => a + r.rating, 0) / reviews.length,
    count: reviews.length,
    cleanliness: avgOf((r) => r.cleanliness),
    location: avgOf((r) => r.location),
    service: avgOf((r) => r.service),
    comfort: avgOf((r) => r.comfort),
    value: avgOf((r) => r.value),
  };
}
