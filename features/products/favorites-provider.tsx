"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

/**
 * Favoris du compte connecté, lus UNE seule fois par compte (audit 17, WEB-2).
 *
 * Avant : chaque cœur de carte lisait son propre favori. 60 cartes = 60
 * requêtes, relancées une seconde fois au démarrage (l'objet `user` change
 * d'identité entre `getSession` et `INITIAL_SESSION`) : ≈ 120 requêtes par
 * accueil, qui faisaient aussi attendre le reste du site derrière le verrou de
 * session de supabase-js (`countries` mesuré à 5,3 s le 16/10).
 *
 * Dépend de `user?.id` (une chaîne), jamais de l'objet `user`.
 */
type FavoritesContextValue = {
  /** true une fois la liste lue (ou sans compte). */
  ready: boolean;
  isFavorite: (productId: string) => boolean;
  /** Bascule un favori ; renvoie le nouvel état. Lève si la base refuse. */
  toggle: (productId: string) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// Garde-fou : bien au-delà d'un usage réel, et reste une seule requête.
const MAX_FAVORITES = 2000;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    setIds(new Set());
    setReady(false);
    if (!userId) {
      setReady(true);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("favorites")
          .select("product_id")
          .eq("user_id", userId)
          .limit(MAX_FAVORITES);
        if (!alive) return;
        if (!error && data) {
          setIds(new Set((data as { product_id: string }[]).map((row) => row.product_id)));
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const isFavorite = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!userId) throw new Error("not_authenticated");
      const wasFavorite = ids.has(productId);
      const apply = (favorite: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (favorite) next.add(productId);
          else next.delete(productId);
          return next;
        });

      // Affichage immédiat, puis retour arrière si la base refuse.
      apply(!wasFavorite);
      const { error } = wasFavorite
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", productId)
        : await supabase.from("favorites").insert({ user_id: userId, product_id: productId });
      // Doublon à l'ajout (23505) : le favori existe déjà — l'état voulu est atteint.
      if (error && !(error.code === "23505" && !wasFavorite)) {
        apply(wasFavorite);
        throw error;
      }
      return !wasFavorite;
    },
    [userId, ids],
  );

  const value = useMemo(() => ({ ready, isFavorite, toggle }), [ready, isFavorite, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites doit être utilisé sous FavoritesProvider");
  return ctx;
}
