"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { isAdLive } from "@/features/ads/ad-window";
import { supabase } from "@/lib/supabase/client";
import type { Advertisement } from "@/types/rivendy";

/**
 * Publicité de la Musique (style « fraîcheur », 2026-10-29) : l'affiche
 * sponsorisée de l'accueil réutilise la position EXISTANTE « bannière
 * d'onglet » du site, ciblée sur l'onglet « musique » (dashboard →
 * Publicités) — aucune table ni position nouvelle. Ciblage par marché, vues
 * et clics comptés par les mêmes fonctions que la marketplace.
 */

export const MUSIC_BANNER_POSITION = "web_category_banner";
/** Valeur de `target_category` choisie au dashboard (liste AD_ONGLETS). */
export const MUSIC_BANNER_TARGET = "musique";

/** Grandes bannières Musique en ligne pour un marché (vide en cas de panne : une pub n'est jamais critique). */
export async function fetchMusicBanners(market: string | null): Promise<Advertisement[]> {
  if (!market) return [];
  const { data, error } = await supabase.from("advertisements").select("*")
    .eq("country_id", market).eq("is_active", true)
    .eq("position", MUSIC_BANNER_POSITION).eq("target_category", MUSIC_BANNER_TARGET)
    .order("display_order", { ascending: true });
  if (error) return [];
  const now = Date.now();
  return ((data ?? []) as Advertisement[]).filter((ad) => !!ad.image_url && isAdLive(ad, now));
}

/** Statut Rivendy+ lu une fois par compte et par chargement de page. */
const status = new Map<string, boolean | null>();

/**
 * Rivendy+ du compte — la règle de l'app (plus_logic.dart, isAdFree) : un
 * Pass actif (active_until dans le futur) ouvre l'écoute SANS publicité.
 * `ready` reste faux tant que le statut n'est pas lu, ou si la lecture
 * échoue : ni pub ni bouton Rivendy+ dans le doute (un abonné ne voit
 * jamais une pub « clignoter »).
 */
export function useMusicPlus(): { ready: boolean; active: boolean } {
  const { user, loading } = useAuth();
  const uid = user?.id ?? null;
  const [read, setRead] = useState<{ uid: string; active: boolean | null } | null>(null);

  useEffect(() => {
    if (!uid || status.has(uid)) return;
    let alive = true;
    void supabase.rpc("rivendy_entitlements").then(({ data, error }) => {
      const until = (data as { active_until?: string | null } | null)?.active_until;
      const active = error ? null : !!until && Date.parse(until) > Date.now();
      status.set(uid, active);
      if (alive) setRead({ uid, active });
    });
    return () => { alive = false; };
  }, [uid]);

  if (loading) return { ready: false, active: false };
  if (!uid) return { ready: true, active: false };
  const active = status.has(uid) ? status.get(uid) ?? null : read?.uid === uid ? read.active : null;
  return active === null ? { ready: false, active: false } : { ready: true, active };
}
