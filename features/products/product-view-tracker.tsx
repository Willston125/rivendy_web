"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Composant invisible qui incrémente views_count via la RPC increment_product_views.
 * Parity Flutter : product_detail_screen.dart → supabase.rpc('increment_product_views').
 * Monté une seule fois par visite (StrictMode-safe via flag).
 *
 * ⚠️ Le paramètre s'appelle `product_id` (signature prod, MEMORY.md 2026-05-22),
 * PAS `p_product_id` : l'ancien nom faisait échouer l'appel en silence
 * (PGRST202) — les vues web n'étaient jamais comptées. Corrigé au Lot F.
 */
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (!productId) return;
    supabase.rpc("increment_product_views", { product_id: productId }).then(
      () => null,
      () => null,
    );
  }, [productId]);

  return null;
}
