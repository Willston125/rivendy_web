"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { applyLocalFilters, enrichListings, searchHotels } from "@/lib/hotels/catalog";
import { RESULTS_PAGE_SIZE, type HotelSearchQuery } from "@/lib/hotels/search-params";
import type { HotelListing } from "@/lib/hotels/types";

export type SearchStatus = "loading" | "ready" | "empty" | "error";

/** Pages serveur lues au maximum pour remplir UN clic « Voir plus ». */
const MAX_PAGES_PER_FETCH = 5;

/**
 * 🔎 Recherche paginée — miroir de `HotelSearchProvider.search/loadMore`,
 * SANS son défaut de pagination.
 *
 * Dans l'app, la page suivante part de `offset = résultats.length` : or les
 * résultats sont FILTRÉS localement (disponibilité, budget, équipements).
 * Dès qu'un hôtel est écarté, l'offset retombe trop tôt dans la liste
 * serveur et les mêmes hôtels reviennent — ou d'autres sont sautés. Ici
 * l'offset compte les lignes SERVEUR lues, indépendamment du filtrage.
 *
 * Un compteur de génération fait que seule la DERNIÈRE recherche lancée
 * publie ses résultats (une requête lente n'écrase pas une récente).
 */
export function useHotelSearch(query: HotelSearchQuery, countryId: string | null, { enabled = true } = {}) {
  const [status, setStatus] = useState<SearchStatus>("loading");
  const [results, setResults] = useState<HotelListing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const generation = useRef(0);
  const serverOffset = useRef(0);
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Clé des critères qui changent la LISTE (le tri, lui, se fait à l'affichage).
  const key = JSON.stringify([
    countryId,
    query.destination.trim(),
    query.stars,
    query.checkIn,
    query.checkOut,
    query.rooms,
    query.adults,
    query.children,
    query.minPrice,
    query.maxPrice,
    query.amenities,
  ]);

  const fetchFiltered = useCallback(async (q: HotelSearchQuery, market: string, startOffset: number) => {
    const collected: HotelListing[] = [];
    let offset = startOffset;
    let more = true;
    for (let i = 0; i < MAX_PAGES_PER_FETCH && more && collected.length === 0; i++) {
      const page = await searchHotels(supabase, q, { countryId: market, offset, limit: RESULTS_PAGE_SIZE });
      offset += page.length;
      more = page.length === RESULTS_PAGE_SIZE;
      const enriched = await enrichListings(supabase, page, q);
      collected.push(...applyLocalFilters(enriched, q));
    }
    return { items: collected, nextOffset: offset, hasMore: more };
  }, []);

  useEffect(() => {
    if (!enabled || !countryId) return;
    const gen = ++generation.current;
    const q = queryRef.current;
    setStatus("loading");
    setLoadMoreError(false);
    serverOffset.current = 0;
    fetchFiltered(q, countryId, 0)
      .then(({ items, nextOffset, hasMore: more }) => {
        if (gen !== generation.current) return;
        serverOffset.current = nextOffset;
        setResults(items);
        setHasMore(more);
        setStatus(items.length ? "ready" : "empty");
      })
      .catch(() => {
        if (gen !== generation.current) return;
        setResults([]);
        setHasMore(false);
        setStatus("error");
      });
    // `key` résume les critères ; `queryRef` porte leur valeur.
  }, [key, enabled, countryId, reloadToken, fetchFiltered]);

  const loadMore = useCallback(async () => {
    if (!countryId || !hasMore || loadingMore || status !== "ready") return;
    const gen = generation.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const { items, nextOffset, hasMore: more } = await fetchFiltered(queryRef.current, countryId, serverOffset.current);
      if (gen !== generation.current) return;
      serverOffset.current = nextOffset;
      setResults((prev) => {
        const seen = new Set(prev.map((h) => h.id));
        return [...prev, ...items.filter((h) => !seen.has(h.id))];
      });
      setHasMore(more);
    } catch {
      if (gen === generation.current) setLoadMoreError(true);
    } finally {
      if (gen === generation.current) setLoadingMore(false);
    }
  }, [countryId, fetchFiltered, hasMore, loadingMore, status]);

  const retry = useCallback(() => setReloadToken((t) => t + 1), []);

  return { status, results, hasMore, loadingMore, loadMoreError, loadMore, retry };
}
