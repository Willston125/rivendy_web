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
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { syntheticEmailFromPhone } from "@/lib/utils/format";
import { DEFAULT_COUNTRY_ID, type Profile } from "@/types/rivendy";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPhone: (phone: string, password: string) => Promise<void>;
  signUpWithPhone: (input: {
    fullName: string;
    phone: string;
    password: string;
    realEmail?: string;
    countryId?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Charge le profil pour un userId donné. N'appelle PAS getUser() (réseau bloquant) :
  // on passe l'id depuis la session déjà disponible. Best-effort, ne throw jamais.
  const loadProfileFor = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      setProfile((data as Profile | null) ?? null);
    } catch {
      // RLS / réseau — on ne bloque pas l'UI
      setProfile(null);
    }
  }, []);

  // Exposé : rafraîchit le profil de l'utilisateur courant.
  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfileFor(data.session?.user?.id ?? null);
  }, [loadProfileFor]);

  useEffect(() => {
    let mounted = true;

    // Filet de sécurité : quoi qu'il arrive, on sort du loading sous 8s
    // (évite le spinner infini de RequireAuth si une requête réseau traîne).
    const safety = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        await loadProfileFor(data.session?.user?.id ?? null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      await loadProfileFor(nextSession?.user?.id ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.subscription.unsubscribe();
    };
  }, [loadProfileFor]);

  const signInWithPhone = useCallback(async (phone: string, password: string) => {
    const email = syntheticEmailFromPhone(phone);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshProfile();
  }, [refreshProfile]);

  const signUpWithPhone = useCallback(
    async ({
      fullName,
      phone,
      password,
      realEmail,
      countryId = DEFAULT_COUNTRY_ID,
    }: {
      fullName: string;
      phone: string;
      password: string;
      realEmail?: string;
      countryId?: string;
    }) => {
      const cleanPhone = phone.trim();
      const email = syntheticEmailFromPhone(cleanPhone);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            whatsapp_number: cleanPhone,
            real_email: realEmail || "",
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: fullName,
          whatsapp_number: cleanPhone,
          real_email: realEmail || "",
          country_id: countryId,
          updated_at: new Date().toISOString(),
        });
      }

      await refreshProfile();
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithPhone,
      signUpWithPhone,
      signOut,
      refreshProfile,
    }),
    [loading, profile, refreshProfile, session, signInWithPhone, signOut, signUpWithPhone],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
