"use client";

/**
 * « Écrire à Rivendy » — la demande arrive dans le dashboard (page « Demandes
 * d'aide »), la réponse revient dans les notifications du compte.
 *
 * Règle du 2026-10-09 : plus aucune demande ne passe par WhatsApp. RPC
 * `create_support_request` (migration 20261009_support_requests.sql) : l'auteur
 * et son marché sont lus en base, 5 demandes par compte et par 24 h.
 */

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

export const SUPPORT_TOPICS = [
  { id: "order", label: "Une commande" },
  { id: "payment", label: "Un paiement ou mon portefeuille" },
  { id: "selling", label: "Vendre sur Rivendy (boost, certification, annonces)" },
  { id: "account", label: "Mon compte" },
  { id: "other", label: "Autre chose" },
] as const;

type TopicId = (typeof SUPPORT_TOPICS)[number]["id"];

const ERRORS: Record<string, string> = {
  not_authenticated: "Connectez-vous pour écrire à Rivendy.",
  message_too_short: "Votre message est trop court (10 caractères minimum).",
  message_too_long: "Votre message est trop long (2 000 caractères maximum).",
  rate_limited: "Vous avez déjà envoyé 5 demandes aujourd'hui. L'équipe Rivendy vous répond dans vos notifications.",
  invalid_topic: "Choisissez le sujet de votre demande.",
};

function isTopic(v: string | undefined): v is TopicId {
  return SUPPORT_TOPICS.some((t) => t.id === v);
}

export function SupportRequestForm({ initialTopic }: { initialTopic?: string }) {
  const { user, loading } = useAuth();
  const [topic, setTopic] = useState<TopicId>(isTopic(initialTopic) ? initialTopic : "order");
  const [orderRef, setOrderRef] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const valid = message.trim().length >= 10;

  async function send() {
    if (!valid || sending) return;
    setSending(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("create_support_request", {
      p_topic: topic,
      p_message: message.trim(),
      p_order_ref: topic === "order" ? orderRef.trim() || null : null,
      p_seller_id: null,
      p_source: "web",
    });
    setSending(false);
    const res = data as { success?: boolean; error?: string } | null;
    if (rpcError || !res?.success) {
      setError(ERRORS[res?.error ?? ""] ?? "La demande n'a pas pu être envoyée. Réessayez dans un moment.");
      return;
    }
    setSent(true);
    setMessage("");
    setOrderRef("");
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />;
  }

  if (!user) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">Connectez-vous pour écrire à l&apos;équipe Rivendy.</p>
        <Link
          href="/auth/login?next=%2Fhelp"
          className="mt-4 inline-flex rounded-full bg-[#009688] px-6 py-3 text-sm font-black text-white transition hover:bg-[#00897B]"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#009688]" />
        <p className="mt-2 font-bold text-[#1A1A1A]">Demande envoyée</p>
        <p className="mt-1 text-sm text-slate-500">
          L&apos;équipe Rivendy vous répond dans vos notifications.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
        >
          Écrire une autre demande
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-white p-6 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Votre demande concerne</span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as TopicId)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none"
        >
          {SUPPORT_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      {topic === "order" && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Référence de la commande (facultatif)</span>
          <input
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            maxLength={40}
            placeholder="CMD-…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm focus:border-[#009688] focus:outline-none"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Votre message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Expliquez-nous ce qui se passe…"
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={!valid || sending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#009688] text-sm font-black text-white transition hover:bg-[#00897B] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer à Rivendy
      </button>
      <p className="text-center text-xs text-slate-400">
        La réponse arrive dans vos notifications Rivendy.
      </p>
    </div>
  );
}
