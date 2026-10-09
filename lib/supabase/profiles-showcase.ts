import type { SupabaseClient } from "@supabase/supabase-js";

/** Colonnes PUBLIQUES d'un profil (vitrine) — rien de privé. */
export type ProfileShowcase = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_certified: boolean | null;
  country_id: string | null;
  store_name: string | null;
};

/**
 * Vitrine de plusieurs profils (nom, photo, badge, boutique), pour un visiteur
 * comme pour un compte connecté.
 *
 * ⚠️ Ne pas joindre `profiles` depuis le navigateur pour lire un AUTRE compte :
 * pour un compte connecté, la table n'est lisible que pour SA propre ligne
 * (la vitrine ne vaut que pour anon). La jointure rendait null — « Boutique
 * Rivendy » à la place du nom, badge absent. RPC `profiles_showcase`
 * (SECURITY DEFINER, colonnes de vitrine seulement) :
 * rivendy_dashboard/supabase/migrations/20261010_seller_showcase.sql.
 */
export async function fetchProfilesShowcase(
  client: SupabaseClient,
  ids: string[],
): Promise<Map<string, ProfileShowcase>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await client.rpc("profiles_showcase", { p_ids: unique });
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as ProfileShowcase[]).map((p) => [p.id, p]));
}
