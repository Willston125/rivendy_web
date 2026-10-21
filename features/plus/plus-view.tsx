"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Smartphone, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { fetchPlusCatalog, requestPlus } from "./plus-api";
import { durationLabel, offerBenefits, requestErrorMessage, type PlusCatalog } from "./plus-logic";

/**
 * Page publique Rivendy+ (Omnicanal lot B, 2026-10-21) : « Un abonnement.
 * Tout Rivendy. » Les formules, prix et moyens de paiement viennent du
 * serveur (rivendy_plus_catalog) ; un moyen n'apparaît que s'il est réellement
 * disponible dans le pays. Vente fermée : seul un compte du dashboard voit les
 * formules (mode essai).
 */
export function PlusView() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { country, countries } = useCountry();
  const [catalog, setCatalog] = useState<PlusCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("");
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    void fetchPlusCatalog(country?.id ?? null).then((c) => {
      if (!alive) return;
      setCatalog(c);
      setPlan((p) => p || c.offers?.[0]?.code || "");
      setChannel((ch) => ch || c.channels?.[0]?.code || "");
      setLoading(false);
    });
    return () => { alive = false; };
  }, [authLoading, user?.id, country?.id]);

  const marketCountry = useMemo(
    () => countries.find((c) => c.id === catalog?.market) ?? null,
    [countries, catalog?.market],
  );
  const offers = catalog?.offers ?? [];
  const channels = catalog?.channels ?? [];
  const chosen = offers.find((o) => o.code === plan) ?? null;

  async function subscribe() {
    if (!chosen || !channel) return;
    setBusy(true);
    setMessage("");
    const res = await requestPlus(chosen.code, channel);
    setBusy(false);
    if (!res.success) { setMessage(requestErrorMessage(res.error)); return; }
    router.push(`/plus/abonnement?demande=${encodeURIComponent(res.pass_id ?? "")}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[#4DB6AC]">
          <Sparkles className="h-4 w-4" /> Rivendy+
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Un abonnement. Tout Rivendy.</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-300">
          Films et séries Premium, musique en écoute complète, contenus exclusifs — sur le site et dans
          l’application, avec le même compte.
        </p>
      </section>

      {loading ? (
        <Card className="mt-8 p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : !catalog?.success ? (
        <Card className="mt-8 p-8 text-center text-sm text-slate-600">
          Choisissez votre pays pour découvrir Rivendy+.
        </Card>
      ) : offers.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <p className="text-lg font-bold text-slate-900">Bientôt disponible dans votre pays</p>
          <p className="mt-2 text-sm text-slate-500">Rivendy+ arrive très prochainement. Revenez nous voir.</p>
        </Card>
      ) : (
        <>
          {catalog.test_mode ? (
            <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Mode essai : la vente n’est pas encore ouverte au public. Seuls les comptes de l’équipe Rivendy voient cette page ainsi.
            </p>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {offers.map((o) => {
              const selected = o.code === plan;
              return (
                <button key={o.code} type="button" onClick={() => setPlan(o.code)} aria-pressed={selected}
                  className={cn("rounded-2xl border bg-white p-6 text-left shadow-sm transition",
                    selected ? "border-[#009688] ring-2 ring-[#009688]" : "border-slate-200 hover:border-slate-300")}>
                  <p className="text-lg font-black text-slate-950">{o.display_name}</p>
                  <p className="mt-1 text-3xl font-black text-[#00796B]">
                    {formatMoney(o.price, marketCountry ?? { currency_code: o.currency, currency_symbol: "" })}
                    <span className="ml-2 text-sm font-semibold text-slate-500">/ {durationLabel(o.duration_hours)}</span>
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                    {offerBenefits(o).map((b) => (
                      <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />{b}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-slate-500">Sans reconduction automatique : vous payez chaque période.</p>
                </button>
              );
            })}
          </div>

          <Card className="mt-6 p-6">
            {!user ? (
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">Connectez-vous pour choisir Rivendy+</p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link href="/auth/login?next=/plus" className={buttonVariants()}>Se connecter</Link>
                  <Link href="/auth/signup" className={buttonVariants({ variant: "outline" })}>Créer un compte</Link>
                </div>
              </div>
            ) : channels.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun moyen de paiement n’est encore disponible dans votre pays.</p>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">Comment voulez-vous payer ?</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {channels.map((c) => {
                    const selected = c.code === channel;
                    const Icon = c.code === "agency" ? Store : Smartphone;
                    return (
                      <button key={c.code} type="button" onClick={() => setChannel(c.code)} aria-pressed={selected}
                        className={cn("flex items-start gap-3 rounded-xl border p-4 text-left",
                          selected ? "border-[#009688] bg-[#E0F2F1]" : "border-slate-200 hover:border-slate-300")}>
                        <Icon className="mt-0.5 h-5 w-5 text-[#00796B]" />
                        <span>
                          <span className="block font-semibold text-slate-900">{c.label}</span>
                          <span className="block text-xs text-slate-500">
                            {c.code === "agency"
                              ? `${c.agencies?.length ?? 0} agence${(c.agencies?.length ?? 0) > 1 ? "s" : ""} — vous payez en espèces avec votre référence`
                              : "Vous envoyez le paiement avec votre téléphone, puis vous le déclarez ici"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {message ? <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{message}</p> : null}
                <Button className="mt-5 w-full sm:w-auto" disabled={busy || !chosen || !channel} onClick={subscribe}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Choisir {chosen?.display_name ?? "Rivendy+"}
                </Button>
                <p className="mt-3 text-xs text-slate-500">
                  Vous recevez une référence RVP-…, valable {catalog.request_valid_days ?? 7} jours. Vos avantages s’ouvrent dès que
                  Rivendy a reçu le paiement.
                </p>
              </>
            )}
          </Card>
        </>
      )}

      {user ? (
        <p className="mt-6 text-center text-sm">
          <Link href="/plus/abonnement" className="font-semibold text-[#00796B] underline">Mon abonnement et mes paiements</Link>
        </p>
      ) : null}
    </div>
  );
}
