"use client";

// ⚠️ Ce formulaire demandait le NUMÉRO, en fabriquait l'email SYNTHÉTIQUE
// `{chiffres}@nikey.app`, et appelait `resetPasswordForEmail` dessus. Ce
// domaine n'a aucune boîte aux lettres : l'écran affichait « Vérifie ta boîte
// mail » et rien n'arrivait jamais. Les étapes « nouveau mot de passe » et
// « succès » vivent désormais sur /auth/reset-password, atteint par le lien.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Info, LifeBuoy, Loader2, Mail } from "lucide-react";
import {
  RECOVERY_MESSAGES,
  requestAccountRecovery,
  requestResetLink,
  resetMessage,
} from "@/lib/utils/password-reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send() {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setError("Adresse email invalide.");
    setError("");
    setLoading(true);
    const res = await requestResetLink(value);
    setLoading(false);
    if (!res.ok) return setError(resetMessage(res));
    setSent(true);
    setCooldown(60);
  }

  // ── « Récupérer mon compte » sans session (APPSOCLE-16) ─────────────
  const [showRecover, setShowRecover] = useState(false);
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rMessage, setRMessage] = useState("");
  const [rBusy, setRBusy] = useState(false);
  const [rSent, setRSent] = useState(false);
  const [rError, setRError] = useState("");

  async function sendRecovery() {
    if (rName.trim().length < 2) return setRError("Indiquez votre nom.");
    if (rPhone.replace(/\D/g, "").length < 7) return setRError("Indiquez votre numéro.");
    if (rMessage.trim().length < 10) return setRError("Décrivez votre problème (10 caractères minimum).");
    setRError("");
    setRBusy(true);
    const res = await requestAccountRecovery({ phone: rPhone, name: rName, message: rMessage });
    setRBusy(false);
    if (!res.ok) return setRError(RECOVERY_MESSAGES[res.reason ?? ""] ?? "Envoi impossible. Réessayez.");
    setRSent(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {!sent ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <Mail className="h-8 w-8 text-[#009688]" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-[#1A1A1A]">Mot de passe oublié</h1>
            <p className="mt-2 text-sm text-slate-500">
              Entrez l&apos;adresse email associée à votre compte Rivendy — nous vous
              enverrons un lien pour choisir un nouveau mot de passe.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600">Adresse email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && send()}
                placeholder="exemple@email.com"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>

            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer le lien"}
            </button>

            {/* L'email est facultatif à l'inscription : le serveur ne dira jamais
                qu'un compte n'en a pas (ce serait un annuaire), c'est donc ici
                qu'il faut l'expliquer — et offrir le canal de secours. */}
            <div className="flex gap-2.5 rounded-2xl bg-slate-50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-xs leading-relaxed text-slate-500">
                L&apos;email est facultatif à l&apos;inscription. Si vous n&apos;en avez
                jamais enregistré, aucun lien ne peut vous être envoyé : utilisez
                « Récupérer mon compte » ci-dessous pour que l&apos;équipe Rivendy
                vous identifie.
              </p>
            </div>

            {/* Canal de secours sans session (audit 21, APPSOCLE-16). */}
            {!showRecover && !rSent && (
              <button
                type="button"
                onClick={() => setShowRecover(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#009688] text-sm font-black text-[#009688] transition hover:bg-[#E0F2F1]"
              >
                <LifeBuoy className="h-4 w-4" /> Récupérer mon compte
              </button>
            )}

            {showRecover && !rSent && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-black text-[#1A1A1A]">Récupérer mon compte</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  Sans adresse e-mail enregistrée ? Envoyez une demande : l&apos;équipe
                  Rivendy vérifie votre identité et vous rend l&apos;accès.
                </p>
                <input
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
                <input
                  type="tel"
                  value={rPhone}
                  onChange={(e) => setRPhone(e.target.value)}
                  placeholder="Votre numéro (ex. +269 321 45 67)"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
                <textarea
                  value={rMessage}
                  onChange={(e) => setRMessage(e.target.value)}
                  placeholder="Expliquez votre problème"
                  className="h-24 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
                {rError && <p className="text-xs font-semibold text-red-500">{rError}</p>}
                <button
                  type="button"
                  onClick={sendRecovery}
                  disabled={rBusy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
                >
                  {rBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer la demande"}
                </button>
              </div>
            )}

            {rSent && (
              <div className="flex gap-2.5 rounded-2xl bg-[#E0F2F1] p-4">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />
                <p className="text-xs leading-relaxed text-[#00695C]">
                  Demande envoyée. L&apos;équipe Rivendy vérifiera votre identité et
                  vous recontactera sur le numéro indiqué.
                </p>
              </div>
            )}

            <p className="text-center text-sm text-slate-500">
              Vous vous en souvenez ?{" "}
              <Link href="/auth/login" className="font-black text-[#009688] hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
            <Mail className="h-10 w-10 text-[#009688]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A]">Vérifiez votre boîte mail</h1>
            {/* Formulation prudente : « si un compte utilise ». Confirmer son
                existence reviendrait à publier la liste des inscrits. */}
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Si un compte Rivendy utilise{" "}
              <span className="font-bold text-[#009688]">{email.trim()}</span>, un lien de
              réinitialisation vient d&apos;y être envoyé. Il expire dans 30 minutes et ne
              peut servir qu&apos;une seule fois.
            </p>
          </div>

          <div className="rounded-2xl bg-orange-50 p-4 text-left text-xs leading-relaxed text-orange-900">
            Rien reçu au bout de 2 minutes ? Regardez dans les courriers indésirables
            (spam) avant de redemander un lien.
          </div>

          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

          <button
            type="button"
            onClick={send}
            disabled={cooldown > 0 || loading}
            className="h-12 w-full rounded-2xl border border-[#009688] text-sm font-black text-[#009688] transition hover:bg-[#E0F2F1] disabled:border-slate-200 disabled:text-slate-400"
          >
            {cooldown > 0 ? `Renvoyer le lien (${cooldown} s)` : "Renvoyer le lien"}
          </button>

          <button
            type="button"
            onClick={() => {
              setSent(false);
              setError("");
            }}
            className="text-sm font-bold text-slate-500 hover:underline"
          >
            Utiliser une autre adresse
          </button>
        </div>
      )}
    </div>
  );
}
