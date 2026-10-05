/**
 * 📆 LOGIQUE PURE DE DISPONIBILITÉ ET DE PRIX — port 1:1 de
 * `rivendy_app/lib/features/hotels/logic/hotel_availability.dart`
 * (verrouillé par 37 tests côté app, PROTECTED_ZONES §1.11).
 *
 * Seule différence de forme : les dates sont des chaînes `AAAA-MM-JJ`
 * (le `DATE` Postgres) au lieu de `DateTime`. En JavaScript, deux `Date`
 * du même jour ne sont pas égales comme clés d'objet ; la chaîne locale
 * l'est, et elle ne dérive jamais de fuseau.
 *
 * ⚠️ RIEN ICI NE FAIT FOI. Ces fonctions servent à peindre une
 * disponibilité et un prix INDICATIF sans aller-retour réseau. Le montant
 * affiché comme total et facturé vient TOUJOURS de la RPC `hotel_quote`,
 * et la disponibilité réelle est relue sous verrou par
 * `hotel_create_booking`.
 */

import { addDaysSql, compareSql, isSqlDate, todaySql } from "./dates";
import type { HotelRoom, HotelServiceItem, HotelServiceUnit, InventoryByDate, RateByDate } from "./types";

/**
 * Les nuits réellement occupées par un séjour.
 *
 * Un séjour du 28 au 30 occupe les nuits du 28 et du 29, PAS celle du 30.
 * Retourne une liste vide si les dates sont incohérentes, jamais d'exception.
 */
export function nightsOfStay(checkIn: string, checkOut: string): string[] {
  if (!isSqlDate(checkIn) || !isSqlDate(checkOut)) return [];
  if (compareSql(checkOut, checkIn) <= 0) return [];
  const nights: string[] = [];
  let cursor = checkIn;
  // Garde-fou : un séjour de plus de 2 ans n'a pas de sens et ne doit pas
  // faire tourner la boucle indéfiniment sur une saisie aberrante.
  while (compareSql(cursor, checkOut) < 0 && nights.length < 731) {
    nights.push(cursor);
    cursor = addDaysSql(cursor, 1);
  }
  return nights;
}

/** Nombre de nuits d'un séjour. 0 si incohérent. */
export function nightCount(checkIn: string, checkOut: string): number {
  return nightsOfStay(checkIn, checkOut).length;
}

/**
 * Vrai si `roomsWanted` chambres sont disponibles sur TOUTES les nuits.
 *
 *  • Une nuit SANS ligne d'inventaire compte pour 0, jamais pour « illimité ».
 *  • C'est la nuit la plus contrainte qui décide.
 */
export function isStayAvailable({
  nights,
  inventoryByDate,
  roomsWanted = 1,
}: {
  nights: string[];
  inventoryByDate: InventoryByDate;
  roomsWanted?: number;
}): boolean {
  if (nights.length === 0 || roomsWanted <= 0) return false;
  for (const night of nights) {
    const day = inventoryByDate[night];
    if (!day || day.availableRooms < roomsWanted) return false;
  }
  return true;
}

/** Le plus petit nombre de chambres disponibles sur les nuits du séjour (0 si une nuit manque). */
export function minAvailableAcrossNights({
  nights,
  inventoryByDate,
}: {
  nights: string[];
  inventoryByDate: InventoryByDate;
}): number {
  if (nights.length === 0) return 0;
  let min = Number.MAX_SAFE_INTEGER;
  for (const night of nights) {
    const available = inventoryByDate[night]?.availableRooms ?? 0;
    if (available < min) min = available;
    if (min === 0) return 0;
  }
  return min;
}

/** La première nuit indisponible, pour dire QUELLE date bloque. */
export function firstUnavailableNight({
  nights,
  inventoryByDate,
  roomsWanted = 1,
}: {
  nights: string[];
  inventoryByDate: InventoryByDate;
  roomsWanted?: number;
}): string | null {
  for (const night of nights) {
    const day = inventoryByDate[night];
    if (!day || day.availableRooms < roomsWanted) return night;
  }
  return null;
}

/**
 * Sous-total chambre INDICATIF : somme des tarifs de chaque nuit × chambres.
 * Le tarif d'une nuit est celui de `hotel_room_rates` s'il existe, sinon
 * `basePrice` — même `COALESCE(rt.price, base_price)` que `hotel_quote`.
 */
export function previewRoomSubtotal({
  nights,
  rateByDate,
  basePrice,
  roomsCount = 1,
}: {
  nights: string[];
  rateByDate: RateByDate;
  basePrice: number;
  roomsCount?: number;
}): number {
  if (nights.length === 0 || roomsCount <= 0) return 0;
  let total = 0;
  for (const night of nights) {
    total += rateByDate[night] ?? basePrice;
  }
  return total * roomsCount;
}

/** Quantité facturée pour un service — miroir exact du `CASE` de la RPC. */
export function serviceQuantity({
  unit,
  nights,
  guests,
}: {
  unit: HotelServiceUnit;
  nights: number;
  guests: number;
}): number {
  switch (unit) {
    case "nuit":
      return nights;
    case "personne":
      return guests;
    case "personne_nuit":
      return guests * nights;
    case "sejour":
    default:
      return 1;
  }
}

/** Total INDICATIF des services sélectionnés (port fidèle ; non utilisé pour un total affiché). */
export function previewServicesTotal({
  services,
  nights,
  guests,
}: {
  services: Pick<HotelServiceItem, "price" | "unit">[];
  nights: number;
  guests: number;
}): number {
  let total = 0;
  for (const s of services) {
    total += s.price * serviceQuantity({ unit: s.unit, nights, guests });
  }
  return total;
}

/** Vrai si la chambre peut accueillir le groupe (la capacité se cumule avec le nombre de chambres). */
export function fitsCapacity({
  room,
  adults,
  children,
  roomsCount = 1,
}: {
  room: Pick<HotelRoom, "capacityAdults" | "capacityChildren">;
  adults: number;
  children: number;
  roomsCount?: number;
}): boolean {
  if (roomsCount <= 0) return false;
  return adults + children <= (room.capacityAdults + room.capacityChildren) * roomsCount;
}

/**
 * Contrôle des dates saisies, avant tout appel réseau.
 * Retourne `null` si tout va bien, sinon le message à afficher.
 */
export function validateStayDates({
  checkIn,
  checkOut,
  today,
}: {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  today?: string;
}): string | null {
  if (!isSqlDate(checkIn) || !isSqlDate(checkOut)) {
    return "Choisissez vos dates d'arrivée et de départ.";
  }
  const ref = today ?? todaySql();
  if (compareSql(checkIn, ref) < 0) return "La date d'arrivée est déjà passée.";
  if (compareSql(checkOut, checkIn) <= 0) return "Le départ doit être après l'arrivée.";
  return null;
}
