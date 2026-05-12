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

  const refreshProfile = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .maybeSingle();

    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await refreshProfile();
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await refreshProfile();
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [refreshProfile]);

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
