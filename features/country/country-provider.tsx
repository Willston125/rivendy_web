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
import { DEFAULT_COUNTRY_ID, type Country, type PaymentMethod } from "@/types/rivendy";

// ─── Types ────────────────────────────────────────────────────────────────────

type CountryContextValue = {
  /** Marché actif — null tant que la sélection n'est pas résolue (parity: needsMarketSelection). */
  country: Country | null;
  /** True si l'init est terminée, aucun marché résolu, ET la liste des pays est disponible. */
  needsMarketSelection: boolean;
  countries: Country[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
  setCountryId: (countryId: string) => Promise<void>;
  /** Relance le chargement des pays (utilisé par le modal si la liste est vide). */
  reloadCountries: () => Promise<void>;
};

const CountryContext = createContext<CountryContextValue | null>(null);

const LS_KEY = "rivendy_country_id";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCountryFromSupabase(countryId: string): Promise<Country | null> {
  if (!countryId) return null;
  const { data } = await supabase
    .from("countries")
    .select("*")
    .eq("id", countryId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as Country | null) ?? null;
}

async function fetchActiveMarkets(): Promise<Country[]> {
  const { data } = await supabase
    .from("countries")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (data as Country[] | null) ?? [];
}

async function fetchPaymentMethods(countryId: string): Promise<PaymentMethod[]> {
  const { data } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("country_id", countryId)
    .eq("is_active", true)
    .order("display_order");
  return (data as PaymentMethod[] | null) ?? [];
}

/** Lit active_market_country_id depuis profiles si l'utilisateur est connecté. */
async function fetchProfileMarket(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("active_market_country_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data as { active_market_country_id?: string | null } | null)
    ?.active_market_country_id ?? null;
}

/** Persiste active_market_country_id dans profiles — best-effort. */
async function persistProfileMarket(marketId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ active_market_country_id: marketId })
    .eq("id", user.id);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Bloque le modal uniquement si l'init EST terminée ET les pays sont bien chargés.
  // Si countries = [] (Supabase injoignable), on ne bloque pas — le modal propose de réessayer.
  const needsMarketSelection = !loading && country === null && countries.length > 0;

  const loadPaymentMethods = useCallback(async (countryId: string) => {
    const methods = await fetchPaymentMethods(countryId);
    setPaymentMethods(methods);
  }, []);

  const reloadCountries = useCallback(async () => {
    const list = await fetchActiveMarkets();
    if (list.length > 0) setCountries(list);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      let resolved: Country | null = null;

      // Retry jusqu'à 3 fois si Supabase est lent à démarrer (cold start Vercel)
      let list: Country[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        list = await fetchActiveMarkets();
        if (list.length > 0) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
      setCountries(list);

      // Étape 0 — Profil Supabase (source autoritaire, parity with Flutter step 0)
      try {
        const profileMarketId = await fetchProfileMarket();
        if (profileMarketId) {
          resolved = list.find((c) => c.id === profileMarketId) ?? null;
          if (!resolved) {
            resolved = await fetchCountryFromSupabase(profileMarketId);
          }
        }
      } catch {
        // non-bloquant
      }

      // Étape 1 — localStorage (cache local)
      if (!resolved) {
        const savedId = localStorage.getItem(LS_KEY);
        if (savedId) {
          resolved = list.find((c) => c.id === savedId) ?? null;
          if (!resolved) {
            // Cache invalide → supprimer (parity with Flutter: remove invalid cache)
            localStorage.removeItem(LS_KEY);
          }
        }
      }

      // Étape 2 — Aucun marché résolu → needsMarketSelection (RÈGLE : pas de fallback DJ silencieux)
      setCountry(resolved);

      if (resolved) {
        localStorage.setItem(LS_KEY, resolved.id);
        await loadPaymentMethods(resolved.id);
      }

      setLoading(false);
    }

    init();
  }, [loadPaymentMethods]);

  const setCountryId = useCallback(
    async (countryId: string) => {
      const next = countries.find((c) => c.id === countryId) ?? null;
      if (!next) return;

      localStorage.setItem(LS_KEY, next.id);
      setCountry(next);
      await loadPaymentMethods(next.id);

      // Parity Flutter : persister dans profiles.active_market_country_id
      persistProfileMarket(next.id).catch(() => null);
    },
    [countries, loadPaymentMethods],
  );

  const value = useMemo<CountryContextValue>(
    () => ({ country, needsMarketSelection, countries, paymentMethods, loading, setCountryId, reloadCountries }),
    [country, needsMarketSelection, countries, loading, paymentMethods, setCountryId, reloadCountries],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) throw new Error("useCountry must be used inside CountryProvider");
  return context;
}

/**
 * Hook pratique — retourne le pays actif ou null si le marché n'est pas encore résolu.
 *
 * ⚠️ RÈGLE : ne jamais forcer DJ en fallback silencieux.
 * Un retour null pendant le chargement permet aux composants d'afficher
 * un skeleton plutôt que du contenu Djibouti erroné.
 *
 * Usage typique :
 *   const country = useCountryOrDefault();
 *   if (!country) return <Skeleton />;
 */
export function useCountryOrDefault(): Country | null {
  const { country, loading } = useCountry();
  // Pendant le chargement initial, on retourne null plutôt que DJ
  if (loading) return null;
  return country;
}

/** Retourne true pendant la résolution initiale du marché. */
export function useCountryLoading(): boolean {
  const { loading } = useCountry();
  return loading;
}
