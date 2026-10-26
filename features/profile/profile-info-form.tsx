"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, Phone, Save, User, Store } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { compressImage } from "@/services/image-upload";
import { useCountry } from "@/features/country/country-provider";
import { phoneHint, validatePhone } from "@/lib/utils/phone-validator";

export function ProfileInfoForm() {
  const { user, profile, refreshProfile } = useAuth();
  const { country } = useCountry();
  // L'identifiant de connexion est le numéro d'INSCRIPTION (email synthétique
  // {chiffres}@nikey.app) : changer le numéro WhatsApp ne le change pas.
  const loginDigits = (user?.email ?? "").endsWith("@nikey.app") ? (user?.email ?? "").split("@")[0] : "";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.whatsapp_number ?? "");
  const [email, setEmail] = useState(profile?.real_email ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [storeName, setStoreName] = useState(profile?.store_name ?? "");
  const [storeDescription, setStoreDescription] = useState(profile?.store_description ?? "");
  const [facebook, setFacebook] = useState(profile?.facebook_url ?? "");
  const [instagram, setInstagram] = useState(profile?.instagram_url ?? "");
  const [tiktok, setTiktok] = useState(profile?.tiktok_url ?? "");

  // Synchronise les champs si le profil arrive après le premier rendu
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.whatsapp_number ?? "");
    setEmail(profile.real_email ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setStoreName(profile.store_name ?? "");
    setStoreDescription(profile.store_description ?? "");
    setFacebook(profile.facebook_url ?? "");
    setInstagram(profile.instagram_url ?? "");
    setTiktok(profile.tiktok_url ?? "");
  }, [profile]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Changement d'adresse de récupération : passe par la fonction serveur
  // change-email (mot de passe exigé), car real_email est figée côté client
  // (audit 21, EDGE-1). On recueille le mot de passe dans une petite invite.
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState("");

  const hasChanges =
    fullName !== (profile?.full_name ?? "") ||
    phone !== (profile?.whatsapp_number ?? "") ||
    email !== (profile?.real_email ?? "") ||
    avatarUrl !== (profile?.avatar_url ?? "") ||
    storeName !== (profile?.store_name ?? "") ||
    storeDescription !== (profile?.store_description ?? "") ||
    facebook !== (profile?.facebook_url ?? "") ||
    instagram !== (profile?.instagram_url ?? "") ||
    tiktok !== (profile?.tiktok_url ?? "");

  // ── Upload avatar ──────────────────────────────────────────
  async function pickAvatar(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.85);
      // Même bucket/chemin que l'app (image_upload_service.dart) → RLS Storage OK
      const path = `${user.id}/${user.id}_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch {
      setError("Erreur lors de l'upload de la photo.");
    } finally {
      setUploading(false);
    }
  }

  // ── Sauvegarder ────────────────────────────────────────────
  async function save() {
    if (!user) return;
    if (!fullName.trim()) return setError("Le nom est requis.");
    // Même validation que l'inscription et que l'app (phone_validator).
    if (phone.trim() !== (profile?.whatsapp_number ?? "")) {
      const phoneError = validatePhone(phone, country?.id ?? profile?.country_id);
      if (phoneError) return setError(phoneError);
    }
    if (email && !/^[\w\-.]+@([\w\-]+\.)+[\w\-]{2,}$/.test(email))
      return setError("Email invalide.");

    setError("");
    setSaving(true);

    /* N'envoyer QUE les colonnes réellement modifiées.
       Corrigé le 2026-09-07 : ce formulaire réécrivait les NEUF colonnes à
       chaque enregistrement, avec les valeurs chargées à l'ouverture de la
       page. Changer un numéro de téléphone ici renvoyait donc aussi
       `avatar_url`, `full_name` et `store_description` — et écrasait en
       silence ce qui venait d'être modifié depuis l'application. Un
       formulaire n'écrit pas ce qu'il n'a pas édité. */
    const candidates: { col: string; next: string | null; prev: string }[] = [
      { col: "full_name",         next: fullName.trim(),                 prev: profile?.full_name ?? "" },
      { col: "whatsapp_number",   next: phone.trim(),                    prev: profile?.whatsapp_number ?? "" },
      { col: "avatar_url",        next: avatarUrl,                       prev: profile?.avatar_url ?? "" },
      { col: "store_name",        next: storeName.trim() || null,        prev: profile?.store_name ?? "" },
      { col: "store_description", next: storeDescription.trim() || null, prev: profile?.store_description ?? "" },
      { col: "facebook_url",      next: facebook.trim() || null,         prev: profile?.facebook_url ?? "" },
      { col: "instagram_url",     next: instagram.trim() || null,        prev: profile?.instagram_url ?? "" },
      { col: "tiktok_url",        next: tiktok.trim() || null,           prev: profile?.tiktok_url ?? "" },
    ];
    const patch: Record<string, string | null> = {};
    for (const { col, next, prev } of candidates) {
      if ((next ?? "") !== prev) patch[col] = next;
    }

    // L'adresse de récupération (real_email) ne s'écrit plus directement : elle
    // est figée côté client et ne change que par la fonction change-email (mot
    // de passe exigé — audit 21, EDGE-1). On la traite à part, APRÈS les autres
    // champs, via une invite mot de passe.
    const newEmail = email.trim();
    const emailChanged = newEmail !== (profile?.real_email ?? "");

    if (Object.keys(patch).length === 0 && !emailChanged) {
      setSaving(false);
      setMessage("Aucune modification à enregistrer.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    if (Object.keys(patch).length > 0) {
      // .select() : on ne dit « mis à jour » que si une ligne a réellement été
      // écrite (une écriture refusée par RLS ne renvoie pas d'erreur).
      const { data: written, error: err } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("id");

      if (err || !written || written.length === 0) {
        setSaving(false);
        return setError("La mise à jour n'a pas pu être enregistrée. Réessayez.");
      }

      // Comme AuthProvider.updatePhone de l'app : les métadonnées suivent le
      // profil. Best effort — profiles fait foi. (real_email n'y est plus :
      // elle est posée par change-email.)
      const metadata: Record<string, string> = {};
      if ("whatsapp_number" in patch) metadata.whatsapp_number = patch.whatsapp_number ?? "";
      if ("full_name" in patch) metadata.full_name = patch.full_name ?? "";
      if (Object.keys(metadata).length > 0) {
        const { error: metaErr } = await supabase.auth.updateUser({ data: metadata });
        if (metaErr) console.error("Métadonnées du compte non synchronisées :", metaErr.message);
      }
      await refreshProfile();
    }

    setSaving(false);

    if (emailChanged) {
      if (!newEmail) {
        // Le retrait d'une adresse de récupération passe par Rivendy.
        setEmail(profile?.real_email ?? "");
        setError("Pour retirer votre adresse de récupération, contactez Rivendy.");
        return;
      }
      setPendingEmail(newEmail);
      setEmailPwd("");
      setEmailNote("");
      setShowEmailModal(true);
      return;
    }

    setMessage("✅ Informations mises à jour !");
    setTimeout(() => setMessage(""), 3000);
  }

  // Confirme le changement d'adresse de récupération via change-email (le
  // JWT du compte connecté est joint automatiquement par supabase-js).
  async function submitEmailChange() {
    if (!pendingEmail) return;
    if (!emailPwd) { setEmailNote("Entrez votre mot de passe actuel."); return; }
    setEmailBusy(true);
    setEmailNote("");
    const { data, error: fnErr } = await supabase.functions.invoke("change-email", {
      body: { email: pendingEmail, password: emailPwd },
    });
    setEmailBusy(false);
    const res = (data ?? {}) as { ok?: boolean; reason?: string };
    if (fnErr || !res.ok) {
      const map: Record<string, string> = {
        wrong_password: "Mot de passe incorrect.",
        email_taken: "Cette adresse est déjà utilisée par un autre compte.",
        invalid_email: "Adresse e-mail invalide.",
        missing_password: "Entrez votre mot de passe actuel.",
        rate_limited: "Trop de tentatives. Réessayez dans une heure.",
        email_not_configured: "L'envoi d'e-mails est momentanément indisponible.",
        email_failed: "Le courriel n'a pas pu être envoyé. Réessayez.",
      };
      setEmailNote(map[res.reason ?? ""] ?? "La modification a échoué. Réessayez.");
      return;
    }
    setShowEmailModal(false);
    setEmailPwd("");
    await refreshProfile();
    setMessage("📧 Un lien de confirmation a été envoyé à votre nouvelle adresse. Ouvrez-le pour l'activer.");
    setTimeout(() => setMessage(""), 6000);
  }

  // ── Avatar initiale ────────────────────────────────────────
  const initials = (fullName || profile?.full_name || "R").slice(0, 1).toUpperCase();

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Compte</p>
        <h1 className="mt-1 text-2xl font-black text-[#1A1A1A]">Informations personnelles</h1>
      </div>

      {/* Avatar */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative"
        >
          <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-[#00C4B4] to-[#6A5ACD]">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">
                {initials}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#009688] shadow">
            <Camera className="h-4 w-4 text-white" />
          </div>
        </button>
        <p className="text-xs text-slate-400">Appuyer pour changer la photo</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Champs */}
      <div className="space-y-4">
        <FormField label="Nom complet *" icon={<User className="h-4 w-4 text-[#009688]" />}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Votre nom"
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <FormField label="Numéro de téléphone" icon={<Phone className="h-4 w-4 text-[#009688]" />}>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={phoneHint(country?.id)}
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>
        {loginDigits && (
          <p className="-mt-2 text-xs text-slate-500">
            Pour vous connecter, utilisez toujours le numéro de votre inscription (+{loginDigits}) :
            changer votre numéro WhatsApp ici ne change pas votre identifiant de connexion.
          </p>
        )}

        <FormField label="Email (optionnel)" icon={<Mail className="h-4 w-4 text-[#009688]" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@email.com"
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>
        <p className="-mt-2 text-xs text-slate-500">
          Adresse de récupération, utile si vous oubliez votre mot de passe. La
          changer demande votre mot de passe actuel, puis une confirmation par
          courriel.
        </p>

        {/* Champs Boutique */}
        <div className="pt-4 pb-2">
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Boutique & Réseaux Sociaux</p>
        </div>

        <FormField label="Nom de la boutique" icon={<Store className="h-4 w-4 text-[#009688]" />}>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ma Super Boutique"
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-600">Description de la boutique</label>
          <textarea
            value={storeDescription}
            onChange={(e) => setStoreDescription(e.target.value)}
            placeholder="Décrivez votre boutique..."
            className="h-24 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>

        <FormField label="Lien Facebook (optionnel)" icon={<span className="text-[#009688] font-bold">f</span>}>
          <input
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/..."
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <FormField label="Lien Instagram (optionnel)" icon={<span className="text-[#009688] font-bold">IG</span>}>
          <input
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/..."
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <FormField label="Lien TikTok (optionnel)" icon={<span className="text-[#009688] font-bold">TK</span>}>
          <input
            type="url"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="https://tiktok.com/@..."
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
        {message && <p className="text-xs font-semibold text-[#009688]">{message}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || !hasChanges}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Enregistrer les modifications
            </>
          )}
        </button>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-black text-[#1A1A1A]">Confirmer le changement d&apos;adresse</h2>
            <p className="mt-1 text-xs text-slate-500">
              Entrez votre mot de passe actuel. Un lien de confirmation sera
              envoyé à <span className="font-semibold">{pendingEmail}</span>.
            </p>
            <input
              type="password"
              value={emailPwd}
              onChange={(e) => setEmailPwd(e.target.value)}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
              className="mt-4 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
            />
            {emailNote && <p className="mt-2 text-xs font-semibold text-red-500">{emailNote}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowEmailModal(false); setEmailPwd(""); setEmail(profile?.real_email ?? ""); }}
                disabled={emailBusy}
                className="h-11 flex-1 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitEmailChange}
                disabled={emailBusy || !emailPwd}
                className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-slate-600">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</div>
        {children}
      </div>
    </div>
  );
}
