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
  /** True si l'init est terminée mais aucun marché n'a été résolu → UI doit afficher le sélecteur. */
  needsMarketSelection: boolean;
  countries: Country[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
  setCountryId: (countryId: string) => Promise<void>;
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

  const needsMarketSelection = !loading && country === null;

  const loadPaymentMethods = useCallback(async (countryId: string) => {
    const methods = await fetchPaymentMethods(countryId);
    setPaymentMethods(methods);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      let resolved: Country | null = null;

      const list = await fetchActiveMarkets();
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
    () => ({ country, needsMarketSelection, countries, paymentMethods, loading, setCountryId }),
    [country, needsMarketSelection, countries, loading, paymentMethods, setCountryId],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) throw new Error("useCountry must be used inside CountryProvider");
  return context;
}

/** Hook pratique — retourne le pays actif ou DJ comme dernier recours d'affichage (jamais null). */
export function useCountryOrDefault(): Country {
  const { country } = useCountry();
  return country ?? {
    id: DEFAULT_COUNTRY_ID,
    name: "Djibouti",
    currency_code: "FDJ",
    currency_symbol: "FDJ",
    whatsapp_number: process.env.NEXT_PUBLIC_RIVENDY_WHATSAPP_FALLBACK || "+25377145306",
    is_active: true,
  };
}
