"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

const CONFIRM_WORD = "SUPPRIMER";

/**
 * Suppression RÉELLE du compte depuis le site — même chemin que l'app
 * (`AuthProvider.deleteAccount`) : l'Edge Function `delete-user` anonymise le
 * profil, retire les annonces, purge les fichiers et supprime le compte de
 * connexion. Jusqu'au 2026-10-04 cette page renvoyait vers l'application.
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

  async function remove() {
    if (busy || typed.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("delete-user", { method: "POST" });
      const success = !fnError && data && typeof data === "object" && (data as { success?: boolean }).success === true;
      if (!success) {
        setError("La suppression du compte a échoué. Réessayez plus tard ou contactez le support.");
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
      <button
        type="button"
        onClick={remove}
        disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Supprimer mon compte
      </button>
    </div>
  );
}
