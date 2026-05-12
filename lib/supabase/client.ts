"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing vars! URL: '${supabaseUrl}', KEY: '${supabaseAnonKey}'`);
}
if (!supabaseUrl.startsWith("http")) {
  throw new Error(`URL must start with http! You provided: '${supabaseUrl}'`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
