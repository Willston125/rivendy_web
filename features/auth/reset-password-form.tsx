"use client";

// ════════════════════════════════════════════════════════════════════
// 🔑 Nouveau mot de passe — atterrissage du lien reçu par email
// ════════════════════════════════════════════════════════════════════
// Sur Android avec l'app installée et à jour, ce lien ouvre RIVENDY
// directement (App Link, intent-filter `/auth/reset-password`). Cette page
// est le chemin de tous les autres : ordinateur, iPhone, app pas encore
// mise à jour. Ce n'est pas un confort — c'est le seul chemin pour les
// utilisateurs restés sur une version antérieure, l'intent-filter n'existant
// que dans un bundle publié.
//
// Le client ne vérifie rien et ne pose rien : l'Edge Function `password-reset`
// applique le changement en service_role, puis révoque toutes les sessions.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Eye, EyeOff, KeyRound, Link2Off, Loader2, User } from "lucide-react";
import { applyResetToken, checkResetToken, resetMessage } from "@/lib/utils/password-reset";

type Phase = "verification" | "pret" | "lienMort" | "succes";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = (params.get("token") ?? "").trim().toLowerCase();

  const [phase, setPhase] = useState<Phase>("verification");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [deadReason, setDeadReason] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Le jeton est vérifié À L'OUVERTURE : annoncer l'expiration après trois
  // minutes de saisie est la meilleure façon de perdre quelqu'un.
  const check = useCallback(async () => {
    if (!/^[0-9a-f]{64}$/.test(token)) {
      setDeadReason("Ce lien est incomplet ou a été tronqué par votre messagerie.");
      setPhase("lienMort");
      return;
    }
    const res = await checkResetToken(token);
    if (!res.ok) {
      setDeadReason(resetMessage(res));
      setPhase("lienMort");
      return;
    }
    setMaskedPhone(String(res.masked_phone ?? ""));
    setFullName(String(res.full_name ?? ""));
    setPhase("pret");
  }, [token]);

  useEffect(() => {
    void check();
  }, [check]);

  async function submit() {
    // Contrôles indicatifs : le serveur revalide, parce qu'un client peut mentir.
    if (password.length < 8) return setError("Minimum 8 caractères.");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");
    setError("");
    setLoading(true);
    const res = await applyResetToken(token, password);
    setLoading(false);
    if (res.ok) return setPhase("succes");
    if (res.reason === "expired" || res.reason === "invalid_token") {
      setDeadReason(resetMessage(res));
      setPhase("lienMort");
      return;
    }
    setError(resetMessage(res));
  }

  if (phase === "verification") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
        <p className="mt-4 text-sm text-slate-500">Vérification du lien…</p>
      </div>
    );
  }

  if (phase === "lienMort") {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <Link2Off className="h-9 w-9 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1A1A1A]">Lien inutilisable</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{deadReason}</p>
        </div>
        <Link
          href="/auth/forgot-password"
          className="flex h-14 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  if (phase === "succes") {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
          <CheckCircle className="h-10 w-10 text-[#009688]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1A1A1A]">Mot de passe modifié</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe. Par
            sécurité, tous les appareils déjà connectés à ce compte ont été déconnectés.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="flex h-14 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
          <KeyRound className="h-8 w-8 text-[#009688]" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-[#1A1A1A]">Nouveau mot de passe</h1>
      </div>

      {/* Rappeler QUEL compte : l'adresse a pu être saisie de travers à
          l'inscription et pointer chez un tiers, qui doit pouvoir s'en rendre
          compte. Le numéro reste masqué. */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 p-4">
        <User className="h-4 w-4 shrink-0 text-[#009688]" />
        <p className="text-sm font-semibold text-slate-700">
          {fullName ? `Compte de ${fullName} · ${maskedPhone}` : `Compte ${maskedPhone}`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-600">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-600">Confirmer le mot de passe</label>
          <input
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
            placeholder="Répétez le mot de passe"
            className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>

        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer le mot de passe"}
        </button>
      </div>
    </div>
  );
}
