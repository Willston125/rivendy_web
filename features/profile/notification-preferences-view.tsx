"use client";

import { useEffect, useState } from "react";
import { BellRing, Info, Loader2, MessageSquareText, Store, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";

/**
 * Préférences de notifications — miroir de `NotificationPreferencesService`
 * (app) et de la table `notification_preferences` (PROTECTED_ZONES §1.13).
 *
 * Règles du contrat, à ne pas assouplir :
 *  - TROIS familles seulement. Commandes, livraison, modération et sécurité
 *    ne se coupent pas — l'écran le dit au lieu de le cacher ;
 *  - la coupure porte sur le PUSH (téléphone), jamais sur la notification :
 *    l'historique reste complet, ici comme dans l'app ;
 *  - ligne absente = TOUT ACTIVÉ ;
 *  - pas de suppression de ligne (aucune policy DELETE, volontairement).
 */

type Prefs = { push_reviews: boolean; push_follows: boolean; push_offers: boolean };
type Family = keyof Prefs;

const ALL_ON: Prefs = { push_reviews: true, push_follows: true, push_offers: true };

const FAMILIES: { key: Family; label: string; sub: string; icon: LucideIcon }[] = [
  {
    key: "push_reviews",
    label: "Avis et commentaires",
    sub: "Avis demandés après une commande, commentaires sur vos articles",
    icon: MessageSquareText,
  },
  {
    key: "push_follows",
    label: "Boutiques suivies",
    sub: "Nouveaux articles des boutiques auxquelles vous êtes abonné",
    icon: Store,
  },
  {
    key: "push_offers",
    label: "Offres Rivendy",
    sub: "Promotions et annonces de Rivendy",
    icon: Tag,
  },
];

export function NotificationPreferencesView() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [prefs, setPrefs] = useState<Prefs>(ALL_ON);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<Family | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("notification_preferences")
      .select("push_reviews, push_follows, push_offers")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // Ligne absente ou lecture impossible → tout activé (jamais muet par défaut).
        setPrefs(data ? { ...ALL_ON, ...(data as Partial<Prefs>) } : ALL_ON);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle(family: Family) {
    if (!userId || saving) return;
    const next = { ...prefs, [family]: !prefs[family] };
    setSaving(family);
    setMessage(null);
    // user_id est la clé primaire : l'upsert vise un index unique complet.
    // `.select()` : on ne dit « enregistré » que si la base a réellement écrit.
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("push_reviews, push_follows, push_offers");
    setSaving(null);
    if (error || !data || data.length === 0) {
      setMessage({ ok: false, text: "Le réglage n'a pas pu être enregistré. Réessayez." });
      return;
    }
    setPrefs({ ...ALL_ON, ...(data[0] as Partial<Prefs>) });
    setMessage({ ok: true, text: "Préférence enregistrée." });
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Compte</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choisissez les notifications envoyées sur votre téléphone par l&apos;application Rivendy.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {FAMILIES.map((f, i) => {
          const on = prefs[f.key];
          return (
            <div
              key={f.key}
              className={cn("flex items-center gap-3 px-4 py-4", i < FAMILIES.length - 1 && "border-b border-slate-50")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E0F2F1]">
                <f.icon className="h-4 w-4 text-[#007168]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1A1A1A]">{f.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{f.sub}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={f.label}
                disabled={!loaded || saving !== null}
                onClick={() => toggle(f.key)}
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
                  on ? "bg-[#009688]" : "bg-slate-200",
                )}
              >
                {saving === f.key ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" />
                ) : (
                  <span
                    className={cn(
                      "inline-block h-5 w-5 rounded-full bg-white shadow transition",
                      on ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {message && (
        <p className={cn("mt-3 text-sm font-semibold", message.ok ? "text-[#007168]" : "text-red-600")}>
          {message.text}
        </p>
      )}

      <div className="mt-5 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />
          <p>
            <span className="font-bold text-slate-800">Toujours actives :</span> commandes, livraison,
            validation de vos articles et alertes de sécurité. Un vendeur qui manque une commande ne vend
            plus, et une alerte « mot de passe modifié » qu&apos;on peut couper ne protège personne.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Ces réglages coupent l&apos;envoi sur le téléphone, pas l&apos;historique : toutes vos
            notifications restent consultables ici et dans l&apos;application.
          </p>
        </div>
      </div>
    </div>
  );
}
