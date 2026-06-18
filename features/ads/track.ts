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

export const trackAdView = (adId: string) => track(adId, "view");
export const trackAdClick = (adId: string) => track(adId, "click");
