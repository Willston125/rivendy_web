import { supabase } from "@/lib/supabase/client";
import type { PlusAgency, PlusChannel } from "@/features/plus/plus-logic";
import type { MyUnlock, UnlockOffer, UnlockUnit } from "./pass-logic";

/**
 * Rivendy Pass — appels au serveur (formules simplifiées, lot 3,
 * 2026-11-17). Le site ne calcule ni prix, ni marché, ni accès : tout vient
 * des fonctions SQL du lot 1 (20261115_1400_formules_5_rivendy_pass.sql), les
 * mêmes que l'app.
 */

/** Niveau, prix et état du titre pour le compte connecté (non connecté : not_authenticated). */
export async function fetchUnlockOffer(titleId: string): Promise<UnlockOffer> {
  const { data, error } = await supabase.rpc("play_unlock_offer", { p_title_id: titleId });
  if (error) return { success: false, error: "network" };
  return (data as UnlockOffer | null) ?? { success: false, error: "unknown" };
}

/** Demandes en cours et titres acquis du compte, pour un titre ou tous. */
export async function fetchMyUnlocks(titleId?: string): Promise<MyUnlock[]> {
  const { data, error } = await supabase.rpc("my_play_unlocks", titleId ? { p_title_id: titleId } : {});
  if (error) return [];
  const res = data as { success?: boolean; unlocks?: MyUnlock[] } | null;
  return res?.success ? res.unlocks ?? [] : [];
}

export interface UnlockRequestResult {
  success: boolean;
  error?: string;
  unlock_id?: string;
  reused?: boolean;
  reference?: string;
  unit?: UnlockUnit;
  title_id?: string;
  title?: string;
  episode_id?: string;
  season?: number;
  price?: number;
  currency?: string;
  market?: string;
  valid_until?: string;
  test_mode?: boolean;
  channel?: PlusChannel;
  agencies?: PlusAgency[];
}

/** Référence RVD-… et prix fixés par le serveur ; la même demande non payée est rendue. */
export async function requestUnlock(
  unit: UnlockUnit, titleId: string, target: { episodeId?: string | null; season?: number | null }, channel: string,
): Promise<UnlockRequestResult> {
  const { data, error } = await supabase.rpc("request_play_unlock", {
    p_unit: unit,
    p_title_id: titleId,
    p_episode_id: unit === "episode" ? target.episodeId ?? null : null,
    p_season: unit === "season" ? target.season ?? null : null,
    p_payment_channel: channel,
  });
  if (error) return { success: false, error: "network" };
  return (data as UnlockRequestResult | null) ?? { success: false, error: "unknown" };
}

/** null si c'est fait, sinon le code d'erreur (mêmes codes que declare_play_pass_payment). */
export async function declareUnlockPayment(
  unlockId: string, payerPhone: string, operatorReference: string, proofPath: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("declare_play_unlock_payment", {
    p_unlock_id: unlockId, p_payer_phone: payerPhone, p_operator_reference: operatorReference, p_proof_path: proofPath,
  });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

/** null si c'est fait, sinon le code d'erreur. */
export async function cancelUnlockRequest(unlockId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("cancel_my_play_unlock_request", { p_unlock_id: unlockId });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

export interface PassPriceRow {
  country_id: string;
  unit: string;
  price: number | string;
  is_on_sale: boolean | null;
}

/** Prix du Pass par marché (table courte, lisible sans compte) : pastilles et fiches des visiteurs. */
export async function fetchPassPrices(): Promise<PassPriceRow[]> {
  const { data, error } = await supabase.from("play_unlock_prices").select("country_id, unit, price, is_on_sale");
  if (error) return [];
  return (data ?? []) as PassPriceRow[];
}

export interface UnlockHistoryRow {
  id: string;
  unit: UnlockUnit;
  title_id: string;
  episode_id: string | null;
  season: number | null;
  country_id: string;
  price: number | string;
  status: "pending" | "active" | "rejected" | "cancelled" | "refunded";
  payment_channel: string | null;
  payment_method: string | null;
  payment_reference: string;
  declared_at: string | null;
  activated_at: string | null;
  created_at: string;
  play_titles: { title: string; kind: string } | null;
  play_episodes: { episode_number: number; season: number } | null;
}

/** Les 30 derniers déblocages et demandes du compte (la RLS ne montre que les siens). */
export async function fetchUnlockHistory(): Promise<UnlockHistoryRow[] | null> {
  const { data, error } = await supabase
    .from("play_unlocks")
    .select("id, unit, title_id, episode_id, season, country_id, price, status, payment_channel, payment_method, payment_reference, declared_at, activated_at, created_at, play_titles(title, kind), play_episodes(episode_number, season)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return null;
  return (data ?? []) as unknown as UnlockHistoryRow[];
}
