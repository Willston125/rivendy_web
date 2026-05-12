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

const fallbackCountry: Country = {
  id: DEFAULT_COUNTRY_ID,
  name: "Djibouti",
  currency_code: "FDJ",
  currency_symbol: "FDJ",
  whatsapp_number: process.env.NEXT_PUBLIC_RIVENDY_WHATSAPP_FALLBACK || "+25377145306",
  is_active: true,
};

type CountryContextValue = {
  country: Country;
  countries: Country[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
  setCountryId: (countryId: string) => Promise<void>;
};

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<Country>(fallbackCountry);
  const [countries, setCountries] = useState<Country[]>([fallbackCountry]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPaymentMethods = useCallback(async (countryId: string) => {
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("country_id", countryId)
      .eq("is_active", true)
      .order("display_order");
    setPaymentMethods((data as PaymentMethod[] | null) ?? []);
  }, []);

  useEffect(() => {
    async function loadCountries() {
      setLoading(true);
      const selected = localStorage.getItem("rivendy_country_id") || DEFAULT_COUNTRY_ID;
      const { data } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("name");

      const list = ((data as Country[] | null) ?? [fallbackCountry]).filter(Boolean);
      const next = list.find((item) => item.id === selected) ?? list.find((item) => item.id === DEFAULT_COUNTRY_ID) ?? fallbackCountry;

      setCountries(list.length ? list : [fallbackCountry]);
      setCountry(next);
      await loadPaymentMethods(next.id);
      setLoading(false);
    }

    loadCountries();
  }, [loadPaymentMethods]);

  const setCountryId = useCallback(
    async (countryId: string) => {
      const next = countries.find((item) => item.id === countryId) ?? fallbackCountry;
      localStorage.setItem("rivendy_country_id", next.id);
      setCountry(next);
      await loadPaymentMethods(next.id);
    },
    [countries, loadPaymentMethods],
  );

  const value = useMemo(
    () => ({ country, countries, paymentMethods, loading, setCountryId }),
    [countries, country, loading, paymentMethods, setCountryId],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) throw new Error("useCountry must be used inside CountryProvider");
  return context;
}
