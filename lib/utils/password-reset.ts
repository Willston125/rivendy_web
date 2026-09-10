"use client";

// ════════════════════════════════════════════════════════════════════
// 🔑 Réinitialisation de mot de passe — SOURCE UNIQUE côté site
// ════════════════════════════════════════════════════════════════════
// POURQUOI ce fichier existe : `supabase.auth.resetPasswordForEmail()` ne
// peut PAS servir ici. Les comptes Rivendy portent un email SYNTHÉTIQUE
// `{chiffres}@nikey.app`, domaine derrière lequel il n'y a AUCUNE boîte aux
// lettres. Le formulaire précédent fabriquait cette adresse à partir du
// numéro, appelait `resetPasswordForEmail`, affichait « Vérifie ta boîte
// mail » — et rien n'arrivait jamais. Silencieux, donc invisible.
//
// L'adresse réelle vit dans `profiles.real_email`. Seule l'Edge Function
// `password-reset` peut la consulter (service_role) : le client n'a aucun
// accès en lecture à cette colonne pour autrui, et c'est voulu.
//
// ⚠️ Le site et l'app DOIVENT rester alignés : c'est le piège §1.10 (une
// règle appliquée sur un seul client) et celui de la couverture de boutique
// (deux colonnes, huit copies de la précédence). Une seule fonction ici.

import { supabase } from "@/lib/supabase/client";

export type ResetResponse = { ok: boolean; reason?: string; [k: string]: unknown };

/** Messages en français, indexés par la raison renvoyée par le serveur. */
export const RESET_MESSAGES: Record<string, string> = {
  invalid_email: "Cette adresse email n'est pas valide.",
  email_not_configured:
    "L'envoi d'emails n'est pas encore activé. Contactez Rivendy depuis Aide & Support.",
  rate_limited_minute: "Patientez une minute avant de redemander un lien.",
  rate_limited_hour:
    "Trop de demandes pour cette adresse. Réessayez dans une heure.",
  email_failed: "L'envoi a échoué. Réessayez dans quelques minutes.",
  storage_failed: "L'envoi a échoué. Réessayez dans quelques minutes.",
  invalid_token: "Ce lien n'est plus valable. Demandez-en un nouveau.",
  expired: "Ce lien a expiré. Demandez-en un nouveau.",
  update_failed: "Le mot de passe n'a pas pu être enregistré. Réessayez.",
};

export function resetMessage(res: ResetResponse): string {
  if (res.reason === "weak_password" && typeof res.message === "string") {
    return res.message;
  }
  return (
    RESET_MESSAGES[res.reason ?? ""] ??
    "Une erreur est survenue. Réessayez dans quelques instants."
  );
}

/**
 * Appelle l'Edge Function. Un statut non-2xx fait lever `functions.invoke` :
 * le corps porte la raison métier, qu'il faut LIRE plutôt que de la
 * transformer en « erreur inconnue ».
 */
async function invoke(body: Record<string, unknown>): Promise<ResetResponse> {
  try {
    const { data } = await supabase.functions.invoke("password-reset", { body });
    return (data ?? {}) as ResetResponse;
  } catch (e: unknown) {
    const ctx = (e as { context?: unknown })?.context;
    if (ctx instanceof Response) {
      try {
        return (await ctx.json()) as ResetResponse;
      } catch {
        /* corps illisible */
      }
    }
    return { ok: false, reason: "network" };
  }
}

/** Demande l'envoi d'un lien. Ne dit JAMAIS si un compte existe. */
export function requestResetLink(email: string) {
  return invoke({ action: "request_email", email: email.trim() });
}

/** Vérifie qu'un jeton est encore valable, avant de faire saisir quoi que ce soit. */
export function checkResetToken(token: string) {
  return invoke({ action: "reset_with_token", token, check: true });
}

/** Pose le nouveau mot de passe. Le serveur seul l'applique. */
export function applyResetToken(token: string, newPassword: string) {
  // Aucun trim() sur le mot de passe : une espace en fait partie.
  return invoke({
    action: "reset_with_token",
    token,
    new_password: newPassword,
  });
}
