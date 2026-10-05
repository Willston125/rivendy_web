"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Hotel as HotelIcon, LoaderCircle, Pencil, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { getAmenityReferential, sortListings } from "@/lib/hotels/catalog";
import { guestsLabel, rangeLabel } from "@/lib/hotels/dates";
import {
  SORT_LABELS,
  activeFilterCount,
  clearedFilters,
  hotelHref,
  parseSearchQuery,
  resultsHref,
  type HotelSearchQuery,
  type HotelSort,
} from "@/lib/hotels/search-params";
import type { HotelAmenity } from "@/lib/hotels/types";
import { HotelSearchForm, type StayFormValue } from "./hotel-search-form";
import { HotelListingCard } from "./hotel-listing-card";
import { AmenityIcon, CardSkeletons, StateBlock } from "./hotel-ui";
import { useHotelFavorites } from "./use-hotel-favorites";
import { useHotelSearch } from "./use-hotel-search";

/**
 * 📋 RÉSULTATS — miroir de `HotelSearchResultsScreen`.
 *
 * Tous les critères vivent dans l'URL : un lien partagé ou un retour arrière
 * retrouve exactement la même recherche. Étoiles filtrées côté serveur ;
 * budget et équipements côté client, comme l'app.
 *
 * Pas de bouton « Carte » : aucun fond de carte n'est intégré au site, et un
 * bouton qui ne fait rien est une interaction morte (même choix que l'app).
 */
export function HotelResultsView() {
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parseSearchQuery(params), [params]);
  const country = useCountryOrDefault();
  const { loading: countryLoading } = useCountry();
  const favorites = useHotelFavorites();
  const search = useHotelSearch(query, country?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [amenities, setAmenities] = useState<HotelAmenity[] | null>(null);
  const [amenityError, setAmenityError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAmenityReferential(supabase)
      .then((list) => {
        if (!cancelled) setAmenities(list);
      })
      .catch(() => {
        if (!cancelled) setAmenityError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // « Mieux notés » n'est proposé que si au moins un hôtel affiché a de vrais avis.
  const hasRatings = search.results.some((h) => h.reviewCount > 0);
  const effectiveSort: HotelSort = query.sort === "rating_desc" && !hasRatings ? "recommended" : query.sort;
  const sorted = useMemo(() => sortListings(search.results, effectiveSort), [search.results, effectiveSort]);
  const sortOptions = (Object.keys(SORT_LABELS) as HotelSort[]).filter((s) => s !== "rating_desc" || hasRatings);

  const hasDates = !!(query.checkIn && query.checkOut);
  const filterCount = activeFilterCount(query);

  function go(next: HotelSearchQuery, mode: "push" | "replace" = "replace") {
    const href = resultsHref(next);
    if (mode === "push") router.push(href);
    else router.replace(href, { scroll: false });
  }

  const formValue: StayFormValue = {
    destination: query.destination,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    rooms: query.rooms,
    adults: query.adults,
    children: query.children,
  };
  const [draftForm, setDraftForm] = useState<StayFormValue>(formValue);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Hôtels", href: "/hotels" }, { label: "Résultats" }]} />

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">
            {query.destination.trim() || "Tous les hôtels"}
          </h1>
          <p className="text-sm text-slate-500">
            {hasDates ? rangeLabel(query.checkIn, query.checkOut) : "Dates non choisies"} ·{" "}
            {guestsLabel(query.adults, query.children, query.rooms)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={editing}
          onClick={() => {
            setDraftForm(formValue);
            setEditing((e) => !e);
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden /> Modifier la recherche
        </Button>
      </div>

      {editing ? (
        <HotelSearchForm
          className="mt-3"
          value={draftForm}
          onChange={setDraftForm}
          submitLabel="Mettre à jour"
          onSubmit={(v) => {
            setEditing(false);
            go({ ...query, ...v }, "push");
          }}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={filterCount > 0 ? "secondary" : "outline"}
          size="sm"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((s) => !s)}
          className={cn(filterCount > 0 && "border border-[#009688] bg-[#E0F2F1] text-[#007168]")}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtres{filterCount > 0 ? ` (${filterCount})` : ""}
        </Button>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <span className="sr-only sm:not-sr-only">Trier</span>
          <Select
            value={effectiveSort}
            onChange={(e) => go({ ...query, sort: e.target.value as HotelSort })}
            className="h-9 w-auto rounded-full py-0 text-sm"
          >
            {sortOptions.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
        {search.status === "ready" ? (
          <span className="ml-auto text-sm font-semibold text-slate-500">
            {search.results.length}
            {search.hasMore ? "+" : ""} établissement{search.results.length > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {showFilters ? (
        <FiltersPanel
          key={params.toString()}
          query={query}
          amenities={amenities}
          amenityError={amenityError}
          onClose={() => setShowFilters(false)}
          onApply={(next) => {
            setShowFilters(false);
            go(next);
          }}
        />
      ) : null}

      <section className="mt-5" aria-live="polite">
        {countryLoading || !country || search.status === "loading" ? (
          <CardSkeletons count={6} />
        ) : search.status === "error" ? (
          <StateBlock
            icon={WifiOff}
            tone="error"
            title="Connexion interrompue"
            message="La recherche n'a pas abouti. Vérifiez votre connexion et réessayez."
            action={{ label: "Réessayer", onClick: search.retry }}
          />
        ) : search.status === "empty" ? (
          <StateBlock
            icon={HotelIcon}
            title={hasDates ? "Aucun hôtel disponible pour ces dates" : "Aucun hôtel trouvé"}
            message={
              hasDates
                ? "Essayez de modifier vos dates ou votre destination."
                : "Aucun établissement ne correspond à cette recherche sur ce marché pour le moment."
            }
            action={
              filterCount > 0
                ? { label: "Effacer les filtres", onClick: () => go(clearedFilters(query)) }
                : {
                    label: "Modifier la recherche",
                    onClick: () => {
                      setDraftForm(formValue);
                      setEditing(true);
                    },
                  }
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((h) => (
                <HotelListingCard
                  key={h.id}
                  hotel={h}
                  href={hotelHref(h.id, query)}
                  hasDates={hasDates}
                  isFavorite={favorites.isFavorite(h.id)}
                  favoritePending={favorites.isPending(h.id)}
                  onToggleFavorite={() => favorites.toggle(h.id)}
                />
              ))}
            </div>
            {search.hasMore ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                {search.loadMoreError ? (
                  <p role="alert" className="text-sm font-semibold text-red-600">
                    Le chargement n&apos;a pas abouti. Réessayez.
                  </p>
                ) : null}
                <Button type="button" variant="outline" onClick={search.loadMore} disabled={search.loadingMore}>
                  {search.loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {search.loadingMore ? "Chargement…" : "Voir plus d'hôtels"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

/** Panneau de filtres — miroir de `HotelFilterSheet` (budget, classement 2–5 étoiles, équipements). */
function FiltersPanel({
  query,
  amenities,
  amenityError,
  onApply,
  onClose,
}: {
  query: HotelSearchQuery;
  amenities: HotelAmenity[] | null;
  amenityError: boolean;
  onApply: (next: HotelSearchQuery) => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(query.minPrice != null ? String(query.minPrice) : "");
  const [max, setMax] = useState(query.maxPrice != null ? String(query.maxPrice) : "");
  const [stars, setStars] = useState<number[]>(query.stars);
  const [codes, setCodes] = useState<string[]>(query.amenities);
  const minId = useId();
  const maxId = useId();

  const toNum = (s: string) => {
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section aria-label="Filtres" className="mt-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-950">Filtres</h2>
        <button type="button" onClick={onClose} aria-label="Fermer les filtres" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-6 md:grid-cols-3">
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-800">Budget par nuit</legend>
          <div className="flex items-center gap-2">
            <label htmlFor={minId} className="sr-only">Minimum</label>
            <input id={minId} inputMode="numeric" placeholder="Minimum" value={min} onChange={(e) => setMin(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]" />
            <span className="text-slate-400" aria-hidden>—</span>
            <label htmlFor={maxId} className="sr-only">Maximum</label>
            <input id={maxId} inputMode="numeric" placeholder="Maximum" value={max} onChange={(e) => setMax(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]" />
          </div>
          <p className="mt-1 text-xs text-slate-500">Dans la monnaie de l&apos;établissement, tarif « à partir de ».</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-800">Classement</legend>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={stars.includes(n)}
                onClick={() => setStars((s) => toggle(s, n).sort())}
                className={cn(
                  "h-10 rounded-full border px-3 text-sm font-bold",
                  stars.includes(n) ? "border-[#009688] bg-[#009688] text-white" : "border-slate-200 bg-white text-slate-800",
                )}
              >
                {n} étoiles
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-slate-800">Équipements</legend>
          {amenityError ? (
            <p className="text-sm text-slate-500">Référentiel indisponible pour le moment.</p>
          ) : amenities == null ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : amenities.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun équipement référencé.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {amenities.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  aria-pressed={codes.includes(a.code)}
                  onClick={() => setCodes((c) => toggle(c, a.code))}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
                    codes.includes(a.code) ? "border-[#009688] bg-[#E0F2F1] text-[#007168]" : "border-slate-200 bg-white text-slate-800",
                  )}
                >
                  <AmenityIcon icon={a.icon} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onApply(clearedFilters(query))}>
          Tout réinitialiser
        </Button>
        <Button
          type="button"
          onClick={() => {
            let lo = toNum(min);
            let hi = toNum(max);
            if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
            onApply({ ...query, minPrice: lo, maxPrice: hi, stars, amenities: codes });
          }}
        >
          Afficher les résultats
        </Button>
      </div>
    </section>
  );
}
