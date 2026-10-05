"use client";

import { supabase } from "@/lib/supabase/client";

/**
 * Tracking des publicités — incrément atomique via le RPC `increment_ad_metric`
 * (SECURITY DEFINER côté Supabase). Fire-and-forget : une pub n'est jamais
 * critique, on n'attend pas la réponse et on avale toute erreur silencieusement.
 */
function track(adId: string, metric: "view" | "click") {
  if (!adId) return;
  void supabase
    .rpc("increment_ad_metric", { p_ad_id: adId, p_metric: metric })
    .then(({ error }) => {
      if (error) console.debug("[ads] track échoué:", error.message);
    });
}

/** Publicités déjà comptées en vue pendant cette session de navigation —
 *  miroir de `_viewedThisSession` de l'app : une vue par pub et par session,
 *  sinon chaque rotation du carrousel ou rechargement gonflait le compteur. */
const SEEN_KEY = "rivendy_ads_seen";

function alreadyCounted(adId: string): boolean {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    if (seen.has(adId)) return true;
    seen.add(adId);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    return false;
  } catch {
    // Stockage indisponible (navigation privée stricte) : compter une fois
    // par chargement de page plutôt que pas du tout.
    return false;
  }
}

export const trackAdView = (adId: string) => {
  if (!adId || alreadyCounted(adId)) return;
  track(adId, "view");
};
export const trackAdClick = (adId: string) => track(adId, "click");
