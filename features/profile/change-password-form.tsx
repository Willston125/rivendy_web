"use client";

import { useState } from "react";
import { CheckCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { syntheticEmailFromPhone } from "@/lib/utils/format";
import { validatePassword } from "@/lib/utils/password-policy";

export function ChangePasswordForm() {
  const { user, profile } = useAuth();

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function changePassword() {
    if (loading) return;
    if (!currentPwd) return setError("Entrez votre mot de passe actuel.");
    // Même politique que l'inscription, l'app et le serveur (password_policy).
    const policyError = validatePassword(newPwd, {
      phone: profile?.whatsapp_number,
      fullName: profile?.full_name,
    });
    if (policyError) return setError(policyError);
    if (newPwd === currentPwd) return setError("Le nouveau mot de passe doit être différent.");
    if (newPwd !== confirmPwd) return setError("Les mots de passe ne correspondent pas.");

    setError("");
    setLoading(true);

    try {
      // 1. Prouver la connaissance du mot de passe actuel : updateUser seul ne
      //    l'exige pas. L'email de connexion est celui de la session (il ne
      //    suit PAS les changements de numéro).
      const phone = profile?.whatsapp_number ?? "";
      const email = user?.email ?? (phone ? syntheticEmailFromPhone(phone) : "");
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPwd,
      });
      if (reAuthErr) {
        setLoading(false);
        const msg = reAuthErr.message.toLowerCase();
        return setError(
          msg.includes("rate") || msg.includes("too many")
            ? "Trop de tentatives. Réessayez dans quelques minutes."
            : "Mot de passe actuel incorrect. Réessayez.",
        );
      }

      // 2. Poser le nouveau mot de passe.
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updateErr) {
        setLoading(false);
        const msg = updateErr.message.toLowerCase();
        return setError(
          msg.includes("should be different") || msg.includes("same as the old")
            ? "Le nouveau mot de passe doit être différent de l'actuel."
            : "Le serveur a refusé ce mot de passe. Choisissez-en un autre.",
        );
      }

      // 3. Le mot de passe EST changé : la suite est du nettoyage, un échec ne
      //    doit pas faire croire que l'opération a raté. Même séquence que
      //    l'app (auth_provider.dart, changePassword) — avant le 2026-10-04
      //    le site laissait l'intrus connecté sur ses autres appareils.
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch (err) {
        console.error("Révocation des autres sessions échouée :", err);
      }
      if (user?.id) {
        // Pour SOI uniquement : la policy exige auth.uid() = user_id.
        // product_id volontairement absent (uuid : une chaîne vide lèverait 22P02).
        const { error: notifErr } = await supabase.from("app_notifications").insert({
          user_id: user.id,
          type: "security",
          title: "🔐 Mot de passe modifié",
          body:
            "Le mot de passe de votre compte vient d'être changé et vos autres appareils ont été " +
            "déconnectés. Si ce n'est pas vous, contactez Rivendy immédiatement.",
          is_read: false,
        });
        if (notifErr) console.error("Alerte de sécurité NON créée :", notifErr.message);
      }
      setLoading(false);
      setDone(true);
    } catch {
      setLoading(false);
      setError("Une erreur est survenue. Réessayez.");
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
          <CheckCircle className="h-10 w-10 text-[#009688]" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#1A1A1A]">Mot de passe mis à jour ✅</h1>
        <p className="mt-2 text-sm text-slate-500">
          Votre mot de passe a été changé. Vos autres appareils ont été déconnectés.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Sécurité</p>
        <h1 className="mt-1 text-2xl font-black text-[#1A1A1A]">Changer le mot de passe</h1>
      </div>

      {/* Info sécurité */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-blue-50 p-4">
        <span className="mt-0.5 text-blue-600">ℹ️</span>
        <p className="text-xs text-blue-800">
          Au moins 8 caractères, différent de l&apos;actuel, sans votre numéro ni votre nom. Vos autres
          appareils seront déconnectés.
        </p>
      </div>

      <div className="space-y-4">
        <PwdField
          label="Mot de passe actuel"
          value={currentPwd}
          onChange={setCurrentPwd}
          show={showCurrent}
          onToggle={() => setShowCurrent((s) => !s)}
        />
        <PwdField
          label="Nouveau mot de passe"
          value={newPwd}
          onChange={setNewPwd}
          show={showNew}
          onToggle={() => setShowNew((s) => !s)}
        />
        <PwdField
          label="Confirmer le nouveau mot de passe"
          value={confirmPwd}
          onChange={setConfirmPwd}
          show={showConfirm}
          onToggle={() => setShowConfirm((s) => !s)}
        />

        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

        <button
          type="button"
          onClick={changePassword}
          disabled={loading || !currentPwd || !newPwd || !confirmPwd}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Changer le mot de passe
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function PwdField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-slate-600">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#009688]" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-12 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
