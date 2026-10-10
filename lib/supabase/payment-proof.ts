import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/services/image-upload";

/**
 * Capture d'écran d'un paiement Mobile Money, jointe à une demande de boost
 * ou d'abonnement (2026-10-10) — miroir de
 * `rivendy_app/lib/features/payments/services/payment_proof_service.dart`.
 *
 * Contrat : `rivendy_dashboard/supabase/migrations/20261010_payment_proofs.sql`
 *  - bucket PRIVÉ `preuves-paiement`, fichier rangé dans le dossier du vendeur ;
 *  - colonne `payment_proof_path` posée à l'envoi de la demande ;
 *  - RPC `attach_payment_proof` pour la joindre APRÈS coup à une demande
 *    encore en attente.
 * Rivendy la lit au dashboard par URL signée — jamais d'URL publique : une
 * capture de paiement porte un numéro de téléphone et un montant. Elle
 * remplace l'envoi par WhatsApp (règle du 2026-10-09).
 */
export const PAYMENT_PROOF_BUCKET = "preuves-paiement";

export type PendingPaymentRequest = {
  id: string;
  payment_reference: string | null;
  payment_method: string | null;
  payment_proof_path: string | null;
};

/** Envoie la capture (compressée en JPEG) ; renvoie son chemin, ou null. */
export async function uploadPaymentProof(userId: string, file: File): Promise<string | null> {
  try {
    // 2 000 px sur le grand côté : le texte d'un SMS de confirmation reste lisible.
    const blob = await compressImage(file, 2000, 0.8);
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${userId}/${Date.now()}-${rand}.jpg`;
    const { error } = await supabase.storage
      .from(PAYMENT_PROOF_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("[payment-proof] envoi :", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.error("[payment-proof] envoi :", e);
    return null;
  }
}

/** Joint une capture déjà envoyée. null si c'est fait, sinon le code d'erreur. */
export async function attachPaymentProof(
  kind: "boost" | "subscription",
  requestId: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("attach_payment_proof", {
    p_kind: kind,
    p_request_id: requestId,
    p_path: path,
  });
  if (error) return "network";
  const res = data as { success?: boolean; error?: string } | null;
  return res?.success ? null : res?.error ?? "unknown";
}

/** Dernière demande EN ATTENTE du vendeur (boost d'un article, ou abonnement). */
export async function fetchPendingPaymentRequest(
  table: "boost_purchases" | "seller_subscriptions",
  userId: string,
  productId?: string,
): Promise<PendingPaymentRequest | null> {
  let query = supabase
    .from(table)
    .select("id, payment_reference, payment_method, payment_proof_path, created_at")
    .eq("seller_id", userId)
    .eq("status", "pending");
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  // Colonne absente (migration pas encore appliquée) ou réseau : pas de rappel.
  if (error || !data?.length) return null;
  return data[0] as PendingPaymentRequest;
}
