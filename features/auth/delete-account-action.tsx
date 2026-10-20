"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

const CONFIRM_WORD = "SUPPRIMER";

/**
 * Suppression RÉELLE du compte depuis le site — même chemin que l'app
 * (`AuthProvider.deleteAccount`) : l'Edge Function `delete-user` vérifie qu'aucune
 * opération n'est en cours, retire les annonces, supprime le compte de connexion
 * puis purge les fichiers personnels. Jusqu'au 2026-10-04 cette page renvoyait
 * vers l'application.
 *
 * On ne ferme la session et on n'annonce la suppression QUE si le serveur a
 * répondu `success: true` — jamais un compte annoncé supprimé qui existe encore.
 */
export function DeleteAccountAction() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  // Audit 19 (RG19-2) : Pass en cours → la suppression attend un accord explicite.
  const [passUntil, setPassUntil] = useState<string | null | undefined>(undefined);

  if (deleted) {
    return (
      <div className="rounded-2xl border border-[#B2DFDB] bg-[#E0F2F1] p-5 text-[#00564F]">
        <p className="font-bold">Votre compte a été supprimé.</p>
        <p className="mt-1 text-sm">Vos données personnelles ont été effacées. Merci d&apos;avoir utilisé Rivendy.</p>
      </div>
    );
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-slate-700">Connectez-vous pour supprimer votre compte depuis le site.</p>
        <Link
          href="/auth/login?next=/delete-account"
          className="mt-3 inline-flex rounded-full bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  async function remove(acceptPassLoss = false) {
    if (busy || typed.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("delete-user", {
        method: "POST",
        body: { accept_pass_loss: acceptPassLoss },
      });
      const result = (data && typeof data === "object" ? data : {}) as {
        success?: boolean;
        error?: string;
        message?: string;
        confirm?: string;
        pass_expires_at?: string | null;
      };
      const success = !fnError && result.success === true;
      if (!fnError && result.confirm === "pass_loss") {
        setPassUntil(result.pass_expires_at ?? null);
        setBusy(false);
        return;
      }
      if (!success) {
        // Refus motivé (audit 17, SB-5) : commande en cours, solde, versement
        // ou séjour — le serveur n'a rien touché et dit quoi faire.
        setError(
          !fnError && result.error === "deletion_blocked" && result.message
            ? result.message
            : "La suppression du compte a échoué. Réessayez plus tard ou contactez le support.",
        );
        setBusy(false);
        return;
      }
      await signOut();
      setDeleted(true);
    } catch {
      setError("La suppression du compte a échoué. Réessayez plus tard ou contactez le support.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
      <p className="font-bold text-red-700">Supprimer définitivement mon compte</p>
      <p className="mt-1 text-sm text-red-700/80">
        Action immédiate et irréversible. Tapez <span className="font-black">{CONFIRM_WORD}</span> pour confirmer.
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={CONFIRM_WORD}
        aria-label={`Tapez ${CONFIRM_WORD} pour confirmer`}
        className="mt-3 h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold outline-none focus:border-red-400"
      />
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
      {passUntil !== undefined && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">Votre Pass sera perdu</p>
          <p className="mt-1">
            Votre Pass Rivendy est actif
            {passUntil
              ? ` jusqu’au ${new Date(passUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
              : ""}
            . Si vous supprimez votre compte maintenant, les jours restants sont perdus et ne sont pas remboursés.
          </p>
          <button
            type="button"
            onClick={() => remove(true)}
            disabled={busy}
            className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer quand même
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => remove()}
        disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Supprimer mon compte
      </button>
    </div>
  );
}
