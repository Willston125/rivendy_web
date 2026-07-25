// ═══════════════════════════════════════════════════════════════════════════
// RÉFÉRENTIEL DE LIVRAISON — parité web
// ═══════════════════════════════════════════════════════════════════════════
// Miroir de :
//   • rivendy_app/lib/features/delivery/models/delivery_location.dart
//   • rivendy_app/lib/features/delivery/services/delivery_location_service.dart
//   • rivendy_app/lib/core/utils/location_normalizer.dart
//   • migration 20260725_grande_comore_delivery_zones.sql
//
// Pourquoi ce fichier : avant lui, le site web n'avait AUCUN frais de livraison
// (juste un champ texte libre). Un acheteur comorien payait donc 500–3 000 KMF
// depuis l'app et 0 depuis le web, pour le même produit.
//
// Hiérarchie du tarif (le plus précis gagne) :
//     quartier.custom_fee_kmf → localité.custom_fee_kmf → région.base_fee_kmf
//
// ⚠️ Un tarif de 0 est LÉGITIME (livraison offerte). Tester `!= null`,
// jamais `> 0`, sinon une livraison offerte retombe sur le tarif régional.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase/client";

/** Marchés dont les zones sont seedées en base. */
const SUPPORTED_MARKETS = new Set(["KM"]);

/**
 * `true` si le marché dispose du référentiel structuré.
 *
 * Les autres marchés conservent le champ texte libre historique : leurs régions
 * et localités ne sont pas encore en base. Ajouter un marché ici suppose de
 * l'avoir seedé au préalable.
 */
export function isStructuredDeliveryMarket(countryId?: string | null): boolean {
  return !!countryId && SUPPORTED_MARKETS.has(countryId);
}

// ── Normalisation ──────────────────────────────────────────────────────────

const ACCENT_FOLDING: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n", ý: "y", ÿ: "y",
};

/**
 * Normalise un nom de lieu pour la recherche.
 *
 * ⚠️ Doit rester STRICTEMENT aligné sur `normalizeLocationName()` (Dart) et
 * `public.normalize_location_name()` (SQL) : la colonne `normalized_name` est
 * calculée en base par un trigger. Toute divergence rend des localités
 * introuvables.
 *
 * Le tiret devient un ESPACE (et n'est pas supprimé) : nécessaire pour que
 * « moroni bambao » retrouve « Moroni-Bambao ».
 */
export function normalizeLocationName(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("")
    .map((char) => ACCENT_FOLDING[char] ?? char)
    .join("")
    .replace(/['’‘`´\-–—]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `true` si [candidate] correspond à [query], accents et tirets ignorés. */
export function matchesLocationQuery(
  candidate?: string | null,
  query?: string | null
): boolean {
  const normalizedQuery = normalizeLocationName(query);
  if (!normalizedQuery) return true;
  return normalizeLocationName(candidate).includes(normalizedQuery);
}

// ── Formatage ──────────────────────────────────────────────────────────────

const NBSP = " ";

/**
 * `1500` → `« 1 500 KMF »`.
 *
 * N'utilise PAS `formatMoney()` : celui-ci suit la devise du marché actif, alors
 * que ces tarifs sont par définition en KMF (colonne `delivery_fee_kmf`).
 */
export function formatKmf(amount: number): string {
  return `${amount.toLocaleString("fr-FR").replace(/\s/g, NBSP)}${NBSP}KMF`;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface DeliveryRegion {
  id: string;
  name: string;
  base_fee_kmf: number;
  display_order: number;
}

export interface DeliveryLocality {
  id: string;
  region_id: string;
  name: string;
  locality_type: string;
  custom_fee_kmf: number | null;
  display_order: number;
}

export interface DeliveryNeighborhood {
  id: string;
  locality_id: string;
  name: string;
  custom_fee_kmf: number | null;
  display_order: number;
}

/** Adresse complète choisie par l'acheteur. */
export interface DeliveryAddress {
  region: DeliveryRegion;
  locality: DeliveryLocality;
  neighborhood: DeliveryNeighborhood | null;
  customNeighborhood: string;
  landmark: string;
  addressDetails: string;
  recipientPhone: string;
  deliveryFeeKmf: number;
}

// ── Lecture du référentiel ─────────────────────────────────────────────────
// `delivery_*` sont en lecture publique (policy `*_read_active`) et ne
// renvoient que les lignes ACTIVES : une zone désactivée depuis le dashboard
// disparaît automatiquement du parcours, sans redéploiement.

export async function fetchRegions(
  countryCode = "KM",
  islandCode = "NGZ"
): Promise<DeliveryRegion[]> {
  const { data, error } = await supabase
    .from("delivery_regions")
    .select("id, name, base_fee_kmf, display_order")
    .eq("country_code", countryCode)
    .eq("island_code", islandCode)
    .eq("is_active", true)
    .order("display_order");
  if (error || !data) return [];
  return data as DeliveryRegion[];
}

export async function fetchLocalities(
  regionId: string
): Promise<DeliveryLocality[]> {
  if (!regionId) return [];
  const { data, error } = await supabase
    .from("delivery_localities")
    .select("id, region_id, name, locality_type, custom_fee_kmf, display_order")
    .eq("region_id", regionId)
    .eq("is_active", true)
    .order("display_order");
  if (error || !data) return [];
  return data as DeliveryLocality[];
}

export async function fetchNeighborhoods(
  localityId: string
): Promise<DeliveryNeighborhood[]> {
  if (!localityId) return [];
  const { data, error } = await supabase
    .from("delivery_neighborhoods")
    .select("id, locality_id, name, custom_fee_kmf, display_order")
    .eq("locality_id", localityId)
    .eq("is_active", true)
    .order("display_order");
  if (error || !data) return [];
  return data as DeliveryNeighborhood[];
}

// ── Tarif ──────────────────────────────────────────────────────────────────

/**
 * Tarif applicable : quartier → localité → région.
 * Miroir de `resolveDeliveryFee()` (Dart) et `resolve_delivery_fee()` (SQL).
 */
export function resolveDeliveryFee(input: {
  region?: DeliveryRegion | null;
  locality?: DeliveryLocality | null;
  neighborhood?: DeliveryNeighborhood | null;
}): number {
  // `!= null` et non `> 0` : 0 = livraison offerte, à ne pas écraser.
  if (input.neighborhood?.custom_fee_kmf != null) {
    return input.neighborhood.custom_fee_kmf;
  }
  if (input.locality?.custom_fee_kmf != null) {
    return input.locality.custom_fee_kmf;
  }
  return input.region?.base_fee_kmf ?? 0;
}

// ── Libellés ───────────────────────────────────────────────────────────────

/** Quartier retenu : celui de la liste, sinon la saisie libre. */
export function neighborhoodLabel(address: DeliveryAddress): string | null {
  if (address.neighborhood) return address.neighborhood.name;
  const custom = address.customNeighborhood.trim();
  return custom.length > 0 ? custom : null;
}

/** « Badjanani, Moroni · Moroni-Bambao » */
export function shortAddressLabel(address: DeliveryAddress): string {
  const quarter = neighborhoodLabel(address);
  const head = quarter
    ? `${quarter}, ${address.locality.name}`
    : address.locality.name;
  return `${head} · ${address.region.name}`;
}

/** Adresse complète multi-lignes, telle qu'envoyée au livreur. */
export function fullAddressLabel(address: DeliveryAddress): string {
  const quarter = neighborhoodLabel(address);
  const parts = [
    ...(quarter ? [quarter] : []),
    address.locality.name,
    address.region.name,
  ];
  let out = parts.join(", ");
  const landmark = address.landmark.trim();
  if (landmark) out += `\nRepère : ${landmark}`;
  const details = address.addressDetails.trim();
  if (details) out += `\n${details}`;
  return out;
}

/**
 * `true` si l'adresse est exploitable par un livreur : un quartier (choisi ou
 * saisi) ET un point de repère. Même règle que `isDeliverable` côté app.
 */
export function isDeliverable(address: DeliveryAddress | null): boolean {
  if (!address) return false;
  const quarter = neighborhoodLabel(address);
  return !!quarter && address.landmark.trim().length > 0;
}

/**
 * Paramètres de snapshot pour la RPC `secure_create_order`.
 *
 * Les NOMS accompagnent les UUID : les libellés et tarifs de zones peuvent
 * changer, une commande passée ne doit jamais être réécrite.
 */
export function orderSnapshotParams(
  address: DeliveryAddress | null
): Record<string, unknown> {
  if (!address) return {};
  return {
    p_delivery_region_id: address.region.id,
    p_delivery_region_name: address.region.name,
    p_delivery_locality_id: address.locality.id,
    p_delivery_locality_name: address.locality.name,
    p_delivery_neighborhood_id: address.neighborhood?.id ?? null,
    p_delivery_neighborhood_name: address.neighborhood?.name ?? null,
    p_custom_neighborhood: address.customNeighborhood.trim() || null,
    p_delivery_landmark: address.landmark.trim() || null,
    p_delivery_address_details: address.addressDetails.trim() || null,
    p_delivery_phone: address.recipientPhone.trim() || null,
    p_delivery_fee_kmf: address.deliveryFeeKmf,
  };
}
