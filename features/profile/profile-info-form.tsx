"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, Phone, Save, User, Store } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { compressImage } from "@/services/image-upload";

export function ProfileInfoForm() {
  const { user, profile, refreshProfile } = useAuth();

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
      const path = `avatars/${user.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("products-images")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("products-images").getPublicUrl(path);
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
    if (phone && phone.replace(/\D/g, "").length < 8)
      return setError("Numéro invalide (minimum 8 chiffres).");
    if (email && !/^[\w\-.]+@([\w\-]+\.)+[\w\-]{2,}$/.test(email))
      return setError("Email invalide.");

    setError("");
    setSaving(true);
    const { error: err } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      whatsapp_number: phone.trim(),
      real_email: email.trim(),
      avatar_url: avatarUrl,
      store_name: storeName.trim() || null,
      store_description: storeDescription.trim() || null,
      facebook_url: facebook.trim() || null,
      instagram_url: instagram.trim() || null,
      tiktok_url: tiktok.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    setSaving(false);
    if (err) return setError(err.message);
    await refreshProfile();
    setMessage("✅ Informations mises à jour !");
    setTimeout(() => setMessage(""), 3000);
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
            placeholder="+253 77 12 34 56"
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <FormField label="Email (optionnel)" icon={<Mail className="h-4 w-4 text-[#009688]" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@email.com"
            className="h-12 w-full rounded-2xl border border-slate-200 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

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
