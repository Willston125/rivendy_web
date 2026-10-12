import { supabase } from "@/lib/supabase/client";
import type { MyPass, PassPlan, PassPrice } from "@/features/play/play-pass-logic";

/**
 * Rivendy Play — accès Supabase de la page Pass Premium (lot 6, 2026-10-12).
 * Tables et fonctions : rivendy_dashboard/supabase/migrations/20261012_play_*.
 */

/** Tarifs d'un marché (lecture publique). null = illisibles (réseau, migration absente). */
export async function fetchPassPrices(market: string): Promise<PassPrice[] | null> {
  const { data, error } = await supabase
    .from("play_pass_prices")
    .select("plan, price, is_on_sale")
    .eq("country_id", market);
  if (error) {
    console.error("[play-pass] tarifs :", error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    plan: r.plan as PassPlan,
    price: Number(r.price),
    is_on_sale: r.is_on_sale === true,
  }));
}

/**
 * Mes pass, les plus récents d'abord (la RLS ne rend que les siens). Les
 * notes de l'équipe ne sont PAS lues : elles servent au dashboard ; le motif
 * d'un refus arrive par notification.
 */
export async function fetchMyPasses(): Promise<MyPass[] | null> {
  const { data, error } = await supabase
    .from("play_passes")
    .select(
      "id, plan, status, price_paid, country_id, payment_method, payment_reference, " +
        "payment_proof_path, starts_at, expires_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[play-pass] mes pass :", error.message);
    return null;
  }
  return (data ?? []) as unknown as MyPass[];
}

/**
 * Notifications `play_pass` du compte, les plus récentes d'abord : elles
 * portent le motif d'un refus (`metadata.reason`), que la page affiche dans
 * « Mes pass » — voir `rejectReasons`. Best effort : [] en cas d'échec.
 */
export async function fetchPassNotifications(userId: string): Promise<Array<{ metadata: unknown }>> {
  const { data, error } = await supabase
    .from("app_notifications")
    .select("metadata")
    .eq("user_id", userId)
    .eq("type", "play_pass")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[play-pass] motifs de refus :", error.message);
    return [];
  }
  return (data ?? []) as Array<{ metadata: unknown }>;
}

export type PassRequestResult =
  | { ok: true; reference: string; price: number; currency: string | null }
  | { ok: false; error: string };

/** Demande de pass : le serveur fixe le prix et le marché (compte), pas le navigateur. */
export async function requestPlayPass(input: {
  plan: PassPlan;
  paymentMethod: string;
  reference: string;
  proofPath: string | null;
}): Promise<PassRequestResult> {
  const { data, error } = await supabase.rpc("request_play_pass", {
    p_plan: input.plan,
    p_payment_method: input.paymentMethod,
    p_payment_reference: input.reference,
    p_proof_path: input.proofPath,
  });
  if (error) {
    console.error("[play-pass] demande :", error.message);
    return { ok: false, error: "network" };
  }
  const res = data as { success?: boolean; error?: string; reference?: string; price?: number; currency?: string } | null;
  if (!res?.success) return { ok: false, error: res?.error ?? "unknown" };
  return {
    ok: true,
    reference: res.reference ?? input.reference,
    price: Number(res.price ?? 0),
    currency: res.currency ?? null,
  };
}

/** Joint une capture à une demande encore en attente. null si c'est fait, sinon le code. */
export async function attachPlayPassProof(passId: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("attach_play_pass_proof", {
    p_pass_id: passId,
    p_path: path,
  });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}
