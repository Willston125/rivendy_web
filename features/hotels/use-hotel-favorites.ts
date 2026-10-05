"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { getFavoriteHotelIds, setHotelFavorite } from "@/lib/hotels/catalog";
import { loginHref } from "@/lib/hotels/search-params";

/**
 * Favoris hôtels (table DÉDIÉE `hotel_favorites`), en OPTIMISTE : le cœur
 * réagit tout de suite et l'état est défait si le serveur refuse — miroir
 * de `HotelSearchProvider.toggleFavorite`.
 *
 * Visiteur non connecté : renvoi vers la connexion, qui ramène ici.
 */
export function useHotelFavorites() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setIds(new Set());
      return;
    }
    getFavoriteHotelIds(supabase)
      .then((next) => {
        if (!cancelled) setIds(next);
      })
      .catch(() => {
        // Les favoris sont un confort : leur échec ne bloque aucun écran.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    async (hotelId: string) => {
      if (loading) return;
      if (!userId) {
        const qs = params.toString();
        router.push(loginHref(`${pathname}${qs ? `?${qs}` : ""}`));
        return;
      }
      const wasFavorite = idsRef.current.has(hotelId);
      const apply = (fav: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (fav) next.add(hotelId);
          else next.delete(hotelId);
          return next;
        });
      apply(!wasFavorite);
      setPending((p) => new Set(p).add(hotelId));
      const ok = await setHotelFavorite(supabase, { userId, hotelId, add: !wasFavorite });
      if (!ok) apply(wasFavorite);
      setPending((p) => {
        const next = new Set(p);
        next.delete(hotelId);
        return next;
      });
    },
    [loading, params, pathname, router, userId],
  );

  return {
    isFavorite: (hotelId: string) => ids.has(hotelId),
    isPending: (hotelId: string) => pending.has(hotelId),
    toggle,
  };
}
