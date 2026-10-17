"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import type { Country, PaymentMethod } from "@/types/rivendy";

// ─── Types ────────────────────────────────────────────────────────────────────

type CountryContextValue = {
  /** Marché actif — null tant que la sélection n'est pas résolue (parity: needsMarketSelection). */
  country: Country | null;
  /** True si l'init est terminée, aucun marché résolu, ET la liste des pays est disponible. */
  needsMarketSelection: boolean;
  countries: Country[];
  /** Moyens de paiement du marché actif — chargés seulement quand un écran
   *  les demande (usePaymentMethods), vides sinon. */
  paymentMethods: PaymentMethod[];
  paymentMethodsLoading: boolean;
  /** Demande le chargement des moyens de paiement (usePaymentMethods). */
  requestPaymentMethods: () => void;
  loading: boolean;
  setCountryId: (countryId: string) => Promise<void>;
  /** Relance le chargement des pays (utilisé par le modal si la liste est vide). */
  reloadCountries: () => Promise<void>;
  /**
   * Marché de la page ouverte (article, boutique) : adopté SEULEMENT si le
   * visiteur n'a encore aucun marché. Ne remplace jamais un choix existant.
   */
  suggestMarket: (countryId: string) => void;
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
  // Audit 17 (WEB-10) : moyens de paiement chargés au paiement seulement
  // (ils l'étaient au démarrage de chaque page), pour le marché actif.
  const [methodsWanted, setMethodsWanted] = useState(false);
  const [loadedMethods, setLoadedMethods] = useState<{ market: string; methods: PaymentMethod[] } | null>(null);
  const [loading, setLoading] = useState(true);
  // Audit 17 (WEB-10) : le marché du profil vient du profil déjà chargé par
  // l'authentification — plus de getUser() (réseau) ni de seconde lecture.
  const { profile, loading: authLoading } = useAuth();
  const [listLoaded, setListLoaded] = useState(false);
  const initDone = useRef(false);
  // Marché suggéré par la page ouverte (lien partagé vers un article ou une boutique).
  // La ref est lue par l'init ; l'état couvre une suggestion arrivée après elle.
  const hintRef = useRef<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Bloque le modal uniquement si l'init EST terminée ET les pays sont bien chargés.
  // Si countries = [] (Supabase injoignable), on ne bloque pas — le modal propose de réessayer.
  // Une suggestion valide en attente l'emporte : le marché de l'article va être adopté.
  const hintPending = !!hint && countries.some((c) => c.id === hint);
  const needsMarketSelection = !loading && country === null && countries.length > 0 && !hintPending;

  const requestPaymentMethods = useCallback(() => setMethodsWanted(true), []);
  const methodsMarket = methodsWanted ? country?.id ?? null : null;
  useEffect(() => {
    if (!methodsMarket) return;
    let cancelled = false;
    fetchPaymentMethods(methodsMarket).then((methods) => {
      if (!cancelled) setLoadedMethods({ market: methodsMarket, methods });
    });
    return () => {
      cancelled = true;
    };
  }, [methodsMarket]);
  const paymentMethods = useMemo(
    () => (methodsMarket && loadedMethods?.market === methodsMarket ? loadedMethods.methods : []),
    [methodsMarket, loadedMethods],
  );
  // Vrai aussi avant la première demande : l'écran qui les demande ne doit
  // pas afficher les moyens de secours le temps que la demande parte.
  const paymentMethodsLoading = !!country && (!methodsWanted || loadedMethods?.market !== country.id);

  const reloadCountries = useCallback(async () => {
    const list = await fetchActiveMarkets();
    if (list.length > 0) setCountries(list);
  }, []);

  // Liste des marchés, en parallèle du chargement de la session et du profil.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Retry jusqu'à 3 fois si Supabase est lent à démarrer (cold start Vercel)
      let list: Country[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        list = await fetchActiveMarkets();
        if (list.length > 0) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
      if (cancelled) return;
      setCountries(list);
      setListLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Résolution du marché, une fois la liste ET le profil (ou son absence) connus.
  useEffect(() => {
    if (!listLoaded || authLoading || initDone.current) return;
    initDone.current = true;
    const list = countries;
    const profileMarketId =
      (profile as { active_market_country_id?: string | null } | null)?.active_market_country_id ?? null;

    async function init() {
      let resolved: Country | null = null;

      // Étape 0 — Profil Supabase (source autoritaire, parity with Flutter step 0)
      try {
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

      // Étape 1 bis — Lien explicite `?country=KM` (lien partagé, sélecteur) : c'est
      // un choix, pas un repli. Sans elle, un visiteur arrivé par /?country=KM voyait
      // l'accueil des Comores ET la fenêtre « Choisissez votre marché » par-dessus.
      if (!resolved) {
        const fromUrl = new URLSearchParams(window.location.search).get("country")?.toUpperCase();
        if (fromUrl) resolved = list.find((c) => c.id === fromUrl) ?? null;
      }

      // Étape 1 ter — Premier passage par un lien d'article ou de boutique : le
      // marché de cet article, au lieu de la fenêtre « Choisissez votre marché »
      // ouverte par-dessus l'article partagé. Modifiable ensuite dans l'en-tête.
      if (!resolved && hintRef.current) {
        resolved = list.find((c) => c.id === hintRef.current) ?? null;
      }

      // Étape 2 — Aucun marché résolu → needsMarketSelection (RÈGLE : pas de fallback DJ silencieux)
      setCountry(resolved);

      if (resolved) localStorage.setItem(LS_KEY, resolved.id);

      setLoading(false);
    }

    void init();
  }, [listLoaded, authLoading, countries, profile]);

  const setCountryId = useCallback(
    async (countryId: string) => {
      const next = countries.find((c) => c.id === countryId) ?? null;
      if (!next) return;

      localStorage.setItem(LS_KEY, next.id);
      setCountry(next);

      // Parity Flutter : persister dans profiles.active_market_country_id
      persistProfileMarket(next.id).catch(() => null);
    },
    [countries],
  );

  const suggestMarket = useCallback((countryId: string) => {
    const id = countryId.toUpperCase();
    hintRef.current = id;
    setHint(id);
  }, []);

  // Suggestion arrivée après l'init, alors qu'aucun marché n'est résolu.
  useEffect(() => {
    if (loading || country || !hint) return;
    const next = countries.find((c) => c.id === hint);
    if (!next) return;
    localStorage.setItem(LS_KEY, next.id);
    setCountry(next);
  }, [hint, loading, country, countries]);

  const value = useMemo<CountryContextValue>(
    () => ({
      country,
      needsMarketSelection,
      countries,
      paymentMethods,
      paymentMethodsLoading,
      requestPaymentMethods,
      loading,
      setCountryId,
      reloadCountries,
      suggestMarket,
    }),
    [
      country,
      needsMarketSelection,
      countries,
      loading,
      paymentMethods,
      paymentMethodsLoading,
      requestPaymentMethods,
      setCountryId,
      reloadCountries,
      suggestMarket,
    ],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) throw new Error("useCountry must be used inside CountryProvider");
  return context;
}

/**
 * Moyens de paiement du marché actif, chargés à la première demande (audit
 * 17, WEB-10). `loading` : liste pas encore arrivée — ne pas proposer de
 * moyens de secours en attendant.
 */
export function usePaymentMethods(): { paymentMethods: PaymentMethod[]; loading: boolean } {
  const { paymentMethods, paymentMethodsLoading, requestPaymentMethods } = useCountry();
  useEffect(() => {
    requestPaymentMethods();
  }, [requestPaymentMethods]);
  return { paymentMethods, loading: paymentMethodsLoading };
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
