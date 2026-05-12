"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { syntheticEmailFromPhone } from "@/lib/utils/format";

type Step = "email" | "sent" | "reset" | "done";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Detect recovery session (user clicked reset link from email)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Étape 1 : Envoyer le lien ──────────────────────────────
  async function sendReset() {
    if (!phone.trim()) return setError("Entrez votre numéro WhatsApp.");
    setError("");
    setLoading(true);
    const email = syntheticEmailFromPhone(phone.trim());
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/forgot-password`,
    });
    setLoading(false);
    if (err) return setError(err.message);
    setStep("sent");
  }

  // ── Étape 3 : Nouveau mot de passe ─────────────────────────
  async function resetPassword() {
    if (newPassword.length < 8)
      return setError("Minimum 8 caractères.");
    if (!/[A-Z]/.test(newPassword))
      return setError("Au moins 1 majuscule requise.");
    if (!/[0-9]/.test(newPassword))
      return setError("Au moins 1 chiffre requis.");
    if (newPassword !== confirmPassword)
      return setError("Les mots de passe ne correspondent pas.");

    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (err) return setError(err.message);
    setStep("done");
  }

  // ── Indicateur 3 étapes ────────────────────────────────────
  const stepIndex = step === "email" ? 0 : step === "sent" ? 0 : step === "reset" ? 1 : 2;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {/* Indicateur */}
      <div className="mb-8 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-3 rounded-full transition-all duration-300 ${
              i === stepIndex ? "w-8 bg-[#009688]" : i < stepIndex ? "w-3 bg-[#009688]" : "w-3 bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* ── EMAIL ────────────────────────────── */}
      {step === "email" && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <Mail className="h-8 w-8 text-[#009688]" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-[#1A1A1A]">Mot de passe oublié</h1>
            <p className="mt-2 text-sm text-slate-500">
              Entrez votre numéro WhatsApp — nous vous enverrons un lien de réinitialisation.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600">Numéro WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReset()}
                placeholder="+253 77 12 34 56"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>

            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

            <button
              type="button"
              onClick={sendReset}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envoyer le lien"}
            </button>

            <p className="text-center text-sm text-slate-500">
              Tu te souviens ?{" "}
              <Link href="/auth/login" className="font-black text-[#009688] hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── EMAIL ENVOYÉ ─────────────────────── */}
      {step === "sent" && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
            <Mail className="h-10 w-10 text-[#009688]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A]">Vérifie ta boîte mail ✉️</h1>
            <p className="mt-3 text-sm text-slate-500">
              Un lien de réinitialisation a été envoyé à l&apos;email lié au numéro{" "}
              <span className="font-bold text-[#009688]">{phone}</span>.
              <br />Clique sur le lien dans l&apos;email pour créer un nouveau mot de passe.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">
            Pas reçu ?{" "}
            <button
              type="button"
              onClick={() => setStep("email")}
              className="font-bold text-[#009688] hover:underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* ── NOUVEAU MDP ─────────────────────── */}
      {step === "reset" && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <KeyRound className="h-8 w-8 text-[#009688]" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-[#1A1A1A]">Nouveau mot de passe</h1>
            <p className="mt-2 text-sm text-slate-500">
              8+ caractères · 1 majuscule · 1 chiffre
            </p>
          </div>

          <div className="space-y-4">
            {/* Nouveau MDP */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmer MDP */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

            <button
              type="button"
              onClick={resetPassword}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Réinitialiser le mot de passe"}
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCÈS ───────────────────────────── */}
      {step === "done" && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
            <CheckCircle className="h-10 w-10 text-[#009688]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A]">Mot de passe modifié ! ✅</h1>
            <p className="mt-2 text-sm text-slate-500">
              Votre mot de passe a été réinitialisé avec succès.
              <br />Vous pouvez maintenant vous connecter.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="flex h-14 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
          >
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
