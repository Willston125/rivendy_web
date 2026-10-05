"use client";

import { supabase } from "@/lib/supabase/client";
import {
  resolveDeliveryFee,
  type DeliveryAddress,
  type DeliveryLocality,
  type DeliveryNeighborhood,
  type DeliveryRegion,
} from "@/lib/utils/delivery-location";

/**
 * Carnet d'adresses — miroir de `DeliveryLocationService.getUserAddresses` /
 * `saveUserAddress` (app). Même table (`user_delivery_addresses`, RLS « propre
 * utilisateur »), mêmes colonnes : une adresse enregistrée dans l'app est
 * proposée sur le site, et inversement. Avant le 2026-10-04 le site ne lisait
 * ni n'écrivait cette table.
 *
 * Le TARIF n'est jamais repris tel qu'enregistré : il est recalculé sur le
 * référentiel ACTUEL (quartier → localité → région), les prix pouvant avoir
 * changé au dashboard depuis l'enregistrement. Une adresse dont la zone a été
 * désactivée est ignorée (la RLS ne renvoie plus la zone), plutôt que
 * d'afficher une adresse non livrable.
 */

export type SavedAddress = DeliveryAddress & { id: string; isDefault: boolean };

type AddressRow = {
  id: string;
  region_id: string | null;
  locality_id: string | null;
  neighborhood_id: string | null;
  custom_neighborhood: string | null;
  landmark: string | null;
  address_details: string | null;
  recipient_phone: string | null;
  is_default: boolean | null;
};

export async function loadSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const { data, error } = await supabase
    .from("user_delivery_addresses")
    .select("id, region_id, locality_id, neighborhood_id, custom_neighborhood, landmark, address_details, recipient_phone, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data?.length) return [];
  const rows = data as AddressRow[];

  const regionIds = [...new Set(rows.map((r) => r.region_id).filter((v): v is string => !!v))];
  const localityIds = [...new Set(rows.map((r) => r.locality_id).filter((v): v is string => !!v))];
  const neighborhoodIds = [...new Set(rows.map((r) => r.neighborhood_id).filter((v): v is string => !!v))];

  const [regionsRes, localitiesRes, neighborhoodsRes] = await Promise.all([
    supabase.from("delivery_regions").select("id, name, base_fee_kmf, display_order").in("id", regionIds).eq("is_active", true),
    supabase.from("delivery_localities").select("id, region_id, name, locality_type, custom_fee_kmf, display_order").in("id", localityIds).eq("is_active", true),
    neighborhoodIds.length
      ? supabase.from("delivery_neighborhoods").select("id, locality_id, name, custom_fee_kmf, display_order").in("id", neighborhoodIds).eq("is_active", true)
      : Promise.resolve({ data: [] as DeliveryNeighborhood[], error: null }),
  ]);
  const regions = new Map(((regionsRes.data ?? []) as DeliveryRegion[]).map((r) => [r.id, r]));
  const localities = new Map(((localitiesRes.data ?? []) as DeliveryLocality[]).map((l) => [l.id, l]));
  const neighborhoods = new Map(((neighborhoodsRes.data ?? []) as DeliveryNeighborhood[]).map((n) => [n.id, n]));

  const out: SavedAddress[] = [];
  for (const row of rows) {
    const region = row.region_id ? regions.get(row.region_id) : undefined;
    const locality = row.locality_id ? localities.get(row.locality_id) : undefined;
    if (!region || !locality) continue; // zone désactivée : adresse non livrable
    const neighborhood = row.neighborhood_id ? neighborhoods.get(row.neighborhood_id) ?? null : null;
    out.push({
      id: row.id,
      isDefault: row.is_default === true,
      region,
      locality,
      neighborhood,
      customNeighborhood: row.custom_neighborhood ?? "",
      landmark: row.landmark ?? "",
      addressDetails: row.address_details ?? "",
      recipientPhone: row.recipient_phone ?? "",
      deliveryFeeKmf: resolveDeliveryFee({ region, locality, neighborhood }),
    });
  }
  return out;
}

/**
 * Enregistre une adresse (best effort : un échec n'empêche jamais la
 * commande). La première adresse devient l'adresse par défaut ; un index
 * unique partiel interdit deux adresses par défaut, on démarque donc d'abord.
 */
export async function saveAddress(userId: string, address: DeliveryAddress, makeDefault: boolean): Promise<boolean> {
  if (makeDefault) {
    await supabase
      .from("user_delivery_addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }
  const { data, error } = await supabase
    .from("user_delivery_addresses")
    .insert({
      user_id: userId,
      region_id: address.region.id,
      locality_id: address.locality.id,
      neighborhood_id: address.neighborhood?.id ?? null,
      custom_neighborhood: address.customNeighborhood.trim() || null,
      landmark: address.landmark.trim() || null,
      address_details: address.addressDetails.trim() || null,
      recipient_phone: address.recipientPhone.trim() || null,
      delivery_fee_kmf: address.deliveryFeeKmf,
      is_default: makeDefault,
    })
    .select("id");
  return !error && !!data?.length;
}
