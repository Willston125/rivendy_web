"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Composant invisible qui incrémente views_count via la RPC increment_product_views.
 * Parity Flutter : product_detail_screen.dart → supabase.rpc('increment_product_views').
 * Monté une seule fois par visite (StrictMode-safe via flag).
 */
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (!productId) return;
    supabase.rpc("increment_product_views", { p_product_id: productId }).then(
      () => null,
      () => null,
    );
  }, [productId]);

  return null;
}
