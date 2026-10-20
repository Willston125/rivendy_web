"use client";

/**
 * Réclamation pour droits d'auteur (audit n° 19, lot G, GC19-4, 2026-10-20).
 * Ouverte à tous, SANS compte : un label ou un artiste qui découvre son œuvre
 * publiée par un tiers sur Rivendy Play ou Rivendy Musique n'avait aucun canal.
 * RPC `copyright_claim_submit` (migration 20261020_2200_audit19_moderation_droits.sql) :
 * rien n'est retiré automatiquement, l'équipe Rivendy vérifie et décide au
 * dashboard (Modération → Droits d'auteur). Plafonds en base : 5 par adresse
 * et par 24 h.
 */

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  bad_name: "Indiquez votre nom (2 à 120 caractères).",
  bad_email: "Adresse e-mail invalide.",
  bad_phone: "Numéro de téléphone invalide (chiffres, espaces et + seulement).",
  bad_capacity: "Indiquez à quel titre vous agissez.",
  holder_required: "Indiquez le titulaire des droits que vous représentez.",
  bad_work: "Indiquez le titre de l'œuvre (2 à 200 caractères).",
  bad_content: "Indiquez le ou les contenus concernés sur Rivendy (liens ou description).",
  statements_required: "Les deux déclarations sont obligatoires.",
  bad_signature: "Signez en écrivant votre nom complet.",
  too_long: "Un des champs est trop long.",
  rate_limited: "Vous avez déjà envoyé 5 réclamations aujourd'hui. L'équipe Rivendy traite celles déjà reçues.",
  busy: "Trop de réclamations en ce moment. Réessayez dans une heure.",
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none";
const label = "mb-1 block text-xs font-semibold text-slate-500";

export function CopyrightClaimForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [capacity, setCapacity] = useState<"holder" | "agent">("holder");
  const [holder, setHolder] = useState("");
  const [work, setWork] = useState("");
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [signature, setSignature] = useState("");
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const ready =
    name.trim().length >= 2 && email.includes("@") && work.trim().length >= 2 && urls.trim().length >= 5
    && goodFaith && accuracy && signature.trim().length >= 2 && (capacity === "holder" || holder.trim().length >= 2);

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("copyright_claim_submit", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_phone: phone.trim() || null,
      p_capacity: capacity,
      p_rights_holder: capacity === "agent" ? holder.trim() : "",
      p_work_title: work.trim(),
      p_work_description: description.trim(),
      p_content_urls: urls.trim(),
      p_good_faith: goodFaith,
      p_accuracy: accuracy,
      p_signature: signature.trim(),
    });
    setSending(false);
    const res = data as { success?: boolean; error?: string; reference?: string } | null;
    if (rpcError || !res?.success || !res.reference) {
      setError(ERRORS[res?.error ?? ""] ?? "La réclamation n'a pas pu être envoyée. Réessayez dans un moment.");
      return;
    }
    setReference(res.reference);
  }

  if (reference) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#009688]" />
        <p className="mt-2 font-bold text-[#1A1A1A]">Réclamation reçue</p>
        <p className="mt-1 text-sm text-slate-600">
          Votre référence : <span className="font-mono font-bold">{reference}</span>. Notez-la : l&apos;équipe Rivendy
          vous répond par e-mail à l&apos;adresse indiquée.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
      onSubmit={(e) => { e.preventDefault(); void send(); }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Votre nom ou celui de votre société</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={input} autoComplete="name" />
        </label>
        <label className="block">
          <span className={label}>Adresse e-mail (pour vous répondre)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={input} autoComplete="email" />
        </label>
      </div>
      <label className="block">
        <span className={label}>Téléphone (facultatif)</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={input} autoComplete="tel" />
      </label>

      <fieldset className="space-y-2">
        <legend className={label}>Vous agissez en tant que</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name="capacity" checked={capacity === "holder"} onChange={() => setCapacity("holder")} />
          Titulaire des droits (auteur, artiste, label, producteur)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" name="capacity" checked={capacity === "agent"} onChange={() => setCapacity("agent")} />
          Représentant autorisé du titulaire
        </label>
        {capacity === "agent" ? (
          <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={160}
            placeholder="Nom du titulaire des droits que vous représentez" aria-label="Titulaire des droits" className={input} />
        ) : null}
      </fieldset>

      <label className="block">
        <span className={label}>Œuvre protégée (titre de la chanson, de l&apos;album, du film, de la vidéo…)</span>
        <input value={work} onChange={(e) => setWork(e.target.value)} maxLength={200} className={input} />
      </label>
      <label className="block">
        <span className={label}>Précisions sur l&apos;œuvre et vos droits (facultatif)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} className={input} />
      </label>
      <label className="block">
        <span className={label}>Contenu(s) concerné(s) sur Rivendy</span>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} maxLength={2000} rows={3} className={input}
          placeholder={"Un lien par ligne, par exemple :\nhttps://www.rivendy.com/musique/release/…\nÀ défaut, le nom du créateur et le titre du contenu."} />
      </label>

      <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} className="mt-1" />
          <span>Je déclare de bonne foi que l&apos;utilisation de cette œuvre sur Rivendy n&apos;est pas autorisée par le titulaire des droits, son représentant ou la loi.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={accuracy} onChange={(e) => setAccuracy(e.target.checked)} className="mt-1" />
          <span>Je déclare que les informations de cette réclamation sont exactes et que je suis le titulaire des droits ou autorisé à agir en son nom.</span>
        </label>
      </div>

      <label className="block">
        <span className={label}>Signature : écrivez votre nom complet</span>
        <input value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={120} className={input} />
      </label>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={!ready || sending}
        className="inline-flex items-center gap-2 rounded-full bg-[#009688] px-6 py-3 text-sm font-black text-white transition hover:bg-[#00897B] disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer la réclamation
      </button>
    </form>
  );
}
