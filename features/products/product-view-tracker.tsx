"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

/**
 * Composant invisible qui incrémente views_count via la RPC increment_product_views.
 * Parity Flutter : product_detail_screen.dart → supabase.rpc('increment_product_views').
 * Monté une seule fois par visite (StrictMode-safe via flag).
 *
 * ⚠️ Le paramètre s'appelle `product_id` (signature prod, MEMORY.md 2026-05-22),
 * PAS `p_product_id` : l'ancien nom faisait échouer l'appel en silence
 * (PGRST202) — les vues web n'étaient jamais comptées. Corrigé au Lot F.
 *
 * Comme l'app (2026-10-04) : le vendeur qui consulte SA propre fiche n'est
 * pas compté — sinon ses statistiques de vues se gonflaient elles-mêmes.
 */
export function ProductViewTracker({ productId, sellerId }: { productId: string; sellerId?: string }) {
  const { user, loading } = useAuth();
  const viewerId = user?.id ?? null;

  useEffect(() => {
    if (!productId || loading) return;
    if (sellerId && viewerId === sellerId) return;
    supabase.rpc("increment_product_views", { product_id: productId }).then(
      () => null,
      () => null,
    );
  }, [productId, sellerId, viewerId, loading]);

  return null;
}
