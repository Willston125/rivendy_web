"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { fetchHomeMarketId } from "@/features/products/publish-market-dialog";

/**
 * Marché de lecture (Play et Musique, comme l'app) : marché d'ORIGINE du
 * compte connecté — celui que le serveur utilise pour les droits — sinon le
 * pays choisi sur le site.
 */
export function useHomeMarket(): string | null {
  const { user } = useAuth();
  const { country } = useCountry();
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchHomeMarketId(supabase, user.id).then((m) => { if (alive) setHome(m); });
    return () => { alive = false; };
  }, [user]);
  return (user ? home : null) ?? country?.id ?? null;
}
