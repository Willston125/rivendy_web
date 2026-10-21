import { supabase } from "@/lib/supabase/client";
import type { MyPeriod, PlusAgency, PlusCatalog, PlusChannel } from "./plus-logic";

/**
 * Rivendy+ — appels au serveur (Omnicanal lot B, 2026-10-21). Le site ne
 * calcule ni prix, ni marché, ni droits : tout vient des fonctions SQL, les
 * mêmes que la future app directe.
 */

export async function fetchPlusCatalog(market: string | null): Promise<PlusCatalog> {
  const { data, error } = await supabase.rpc("rivendy_plus_catalog", { p_market: market });
  if (error) return { success: false, error: "network" };
  return (data as PlusCatalog | null) ?? { success: false, error: "unknown" };
}

export interface PlusRequestResult {
  success: boolean;
  error?: string;
  pass_id?: string;
  reference?: string;
  reused?: boolean;
  price?: number;
  currency?: string;
  offer?: string;
  valid_until?: string;
  test_mode?: boolean;
  channel?: PlusChannel;
  agencies?: PlusAgency[];
}

export async function requestPlus(plan: string, channel: string): Promise<PlusRequestResult> {
  const { data, error } = await supabase.rpc("request_play_pass", { p_plan: plan, p_payment_channel: channel });
  if (error) return { success: false, error: "network" };
  return (data as PlusRequestResult | null) ?? { success: false, error: "unknown" };
}

/** null si c'est fait, sinon le code d'erreur. */
export async function declarePlusPayment(
  passId: string, payerPhone: string, operatorReference: string, proofPath: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("declare_play_pass_payment", {
    p_pass_id: passId, p_payer_phone: payerPhone, p_operator_reference: operatorReference, p_proof_path: proofPath,
  });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

/** null si c'est fait, sinon le code d'erreur. */
export async function cancelPlusRequest(passId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("cancel_my_play_pass_request", { p_pass_id: passId });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

export interface MyEntitlements {
  plus?: boolean;
  offer?: string | null;
  label?: string | null;
  active_until?: string | null;
  play_premium?: boolean;
  music_premium?: boolean;
  simultaneous_streams?: number;
}

export async function fetchMyEntitlements(): Promise<MyEntitlements | null> {
  const { data, error } = await supabase.rpc("rivendy_entitlements");
  if (error) return null;
  return (data as MyEntitlements | null) ?? null;
}

/** Les 20 dernières périodes et demandes du compte (la RLS ne montre que les siennes). */
export async function fetchMyPeriods(): Promise<MyPeriod[] | null> {
  const { data, error } = await supabase
    .from("play_passes")
    .select("id, plan, status, price_paid, country_id, payment_method, payment_reference, payment_channel, declared_at, agency_id, starts_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return null;
  return (data ?? []) as MyPeriod[];
}

/** Noms des agences actives (lisibles par tous). */
export async function fetchAgencyNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("agencies").select("id, name").in("id", ids);
  const out: Record<string, string> = {};
  for (const a of (data ?? []) as { id: string; name: string }[]) out[a.id] = a.name;
  return out;
}

/** Notifications « play_pass » du compte : motifs de refus (affichés sur le site seulement). */
export async function fetchPassNotifications(): Promise<Array<{ metadata?: unknown }>> {
  const { data } = await supabase
    .from("app_notifications")
    .select("metadata")
    .eq("type", "play_pass")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Array<{ metadata?: unknown }>;
}
