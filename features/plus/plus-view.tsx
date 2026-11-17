"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Music, ShoppingBag, Smartphone, Sparkles, Store, Truck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { fetchPassPrices } from "@/features/play/pass-api";
import { passPriceFor } from "@/features/play/pass-logic";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { fetchOfferEntitlements, fetchPlusCatalog, requestPlus } from "./plus-api";
import { benefitGroups, compareRows, durationLabel, requestErrorMessage, type PlusCatalog } from "./plus-logic";

/**
 * Page publique Rivendy+ (Omnicanal lot B, 2026-10-21 ; refondue au lot 3 des
 * formules simplifiées, 2026-11-17, d'après le canevas validé) : « Un
 * abonnement. Tout Rivendy. » Formules, prix, avantages et moyens de paiement
 * viennent du serveur (rivendy_plus_catalog, rivendy_offer_entitlements_resolved) ;
 * un avantage à zéro dans le marché n'est pas promis (à Djibouti : aucune
 * livraison offerte). Vente fermée : seul un compte du dashboard voit les
 * formules (mode essai).
 */
export function PlusView() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { country, countries } = useCountry();
  const [catalog, setCatalog] = useState<PlusCatalog | null>(null);
  const [freeEnt, setFreeEnt] = useState<Record<string, unknown> | null>(null);
  const [passPrice, setPassPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    void fetchPlusCatalog(country?.id ?? null).then(async (c) => {
      const market = c.success ? c.market ?? null : null;
      const [free, prices] = await Promise.all([
        market ? fetchOfferEntitlements("free", market) : Promise.resolve(null),
        fetchPassPrices(),
      ]);
      if (!alive) return;
      setCatalog(c);
      setFreeEnt(free);
      setPassPrice(passPriceFor(prices, market, "title"));
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
  // Une seule formule payante (grille du 15/11) : l'abonnement Rivendy+.
  const offer = offers.find((o) => o.kind === "subscription") ?? offers[0] ?? null;
  const money = (amount: number) =>
    formatMoney(amount, marketCountry ?? { currency_code: offer?.currency ?? catalog?.currency ?? "", currency_symbol: "" });
  const price = offer ? money(offer.price) : "";
  const per = offer ? (offer.duration_hours === 720 ? "mois" : durationLabel(offer.duration_hours)) : "mois";
  const groups = offer ? benefitGroups(offer.entitlements ?? {}, money) : null;
  const rows = offer && freeEnt ? compareRows(freeEnt, offer.entitlements ?? {}, money) : [];

  async function subscribe() {
    if (!offer || !channel) return;
    setBusy(true);
    setMessage("");
    const res = await requestPlus(offer.code, channel);
    setBusy(false);
    if (!res.success) { setMessage(requestErrorMessage(res.error)); return; }
    router.push(`/plus/abonnement?demande=${encodeURIComponent(res.pass_id ?? "")}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <section className="flex flex-wrap items-end gap-8 rounded-[28px] bg-slate-950 px-6 py-10 text-white sm:px-10">
        <div className="min-w-0 flex-[999_1_480px]">
          <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-[#4DB6AC]">
            <Sparkles className="h-4 w-4" aria-hidden /> Rivendy+
          </p>
          <h1 className="mt-3 text-4xl font-black leading-[1.05] sm:text-5xl">Un abonnement.<br />Tout Rivendy.</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-[17px]">
            Vendez plus, faites-vous livrer moins cher, regardez et écoutez tout. Sur le site et dans l’application, avec le même compte.
          </p>
        </div>
        {offer ? (
          <div className="flex-[1_1_260px] rounded-2xl border border-slate-800 bg-slate-900 p-6">
            {marketCountry ? <p className="text-sm font-bold text-slate-400">{marketCountry.name}</p> : null}
            <p className="mt-1 text-4xl font-black leading-none">
              {price}<span className="text-base font-bold text-slate-400"> / {per}</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">Sans reconduction automatique : vous payez chaque {per === "mois" ? "mois" : "période"}.</p>
            <a href="#payer" className="mt-5 flex h-12 items-center justify-center rounded-full bg-[#00796B] text-[15px] font-extrabold text-white hover:bg-[#00695C]">
              Choisir Rivendy+
            </a>
          </div>
        ) : null}
      </section>

      {loading ? (
        <Card className="mt-8 p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : !catalog?.success ? (
        <Card className="mt-8 p-8 text-center text-sm text-slate-600">
          Choisissez votre pays pour découvrir Rivendy+.
        </Card>
      ) : !offer || !groups ? (
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

          <section className="mt-7 grid gap-4 md:grid-cols-3">
            <BenefitCard icon={ShoppingBag} title="Pour vendre" items={groups.sell} />
            <BenefitCard icon={Truck} title="Pour acheter" items={groups.buy}
              note={groups.buy.length
                ? "En Grande Comore, où Rivendy livre. Le vendeur reçoit toujours son prix : c’est Rivendy qui paie la part offerte."
                : "Les avantages de livraison valent en Grande Comore, où Rivendy livre."} />
            <BenefitCard icon={Music} title="Pour regarder et écouter" items={groups.watch} />
          </section>

          {rows.length ? (
            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <h2 className="text-2xl font-black text-slate-950">Gratuit ou Rivendy+</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[13px] text-slate-500">
                      <th scope="col" className="px-3 py-2.5 font-bold"><span className="sr-only">Avantage</span></th>
                      <th scope="col" className="w-[28%] px-3 py-2.5 font-extrabold">Gratuit</th>
                      <th scope="col" className="w-[32%] rounded-t-xl bg-[#E0F2F1] px-3 py-2.5 font-black text-[#00695C]">Rivendy+ · {price}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.label} className="border-t border-slate-100">
                        <th scope="row" className="px-3 py-3 text-left font-semibold text-slate-800">{r.label}</th>
                        <td className={cn("px-3 py-3", r.free === "—" || r.free === "Aucun" ? "text-slate-500" : "text-slate-800")}>{r.free}</td>
                        <td className={cn("bg-[#F0FAF9] px-3 py-3 font-bold text-slate-900", i === rows.length - 1 && "rounded-b-xl")}>{r.plus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="mt-7 flex flex-wrap items-stretch gap-4">
            <div id="payer" className="min-w-0 flex-[999_1_520px] scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              {!user ? (
                <div className="text-center">
                  <p className="text-base font-semibold text-slate-900">Connectez-vous pour choisir Rivendy+</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link href="/auth/login?next=/plus" className={buttonVariants()}>Se connecter</Link>
                    <Link href="/auth/signup" className={buttonVariants({ variant: "outline" })}>Créer un compte</Link>
                  </div>
                </div>
              ) : channels.length === 0 ? (
                <p className="text-sm text-slate-600">Aucun moyen de paiement n’est encore disponible dans votre pays.</p>
              ) : (
                <>
                  <h2 className="text-xl font-black text-slate-950">Comment voulez-vous payer ?</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {channels.map((c) => {
                      const selected = c.code === channel;
                      const Icon = c.code === "agency" ? Store : Smartphone;
                      return (
                        <button key={c.code} type="button" onClick={() => setChannel(c.code)} aria-pressed={selected}
                          className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left",
                            selected ? "border-[#00796B] bg-[#E0F2F1]" : "border-slate-200 bg-white hover:border-slate-300")}>
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#00796B]" aria-hidden />
                          <span>
                            <span className="block font-extrabold text-slate-900">{c.label}</span>
                            <span className="mt-0.5 block text-[13px] text-slate-500">
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
                  <Button className="mt-5 h-12 w-full rounded-full px-7 sm:w-auto" disabled={busy || !channel} onClick={subscribe}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Choisir {offer.display_name || "Rivendy+"} · {price}
                  </Button>
                  <p className="mt-3 text-[13px] text-slate-500">
                    Vous recevez une référence RVP-…, valable {catalog.request_valid_days ?? 7} jours. Vos avantages s’ouvrent dès que
                    Rivendy a reçu le paiement.
                  </p>
                </>
              )}
            </div>

            {passPrice != null ? (
              <div className="flex flex-[1_1_280px] flex-col gap-2.5 rounded-2xl bg-[#020907] p-6 text-[#F7FAF8] sm:p-7">
                <p className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#00D6A3]">Rivendy Pass</p>
                <p className="text-[22px] font-black leading-tight">Juste un film ?</p>
                <p className="text-[15px] leading-relaxed text-[#9BB3A9]">
                  Débloquez un film ou un épisode pour {money(passPrice)}, ou une saison entière à son prix. Il reste à vous pour toujours, sans abonnement.
                </p>
                <Link href="/play/movies" className="mt-auto pt-2 text-sm font-extrabold text-[#00D6A3] hover:text-[#2BE3B5]">Voir Rivendy Play</Link>
              </div>
            ) : null}
          </section>

          <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <h2 className="text-xl font-black text-slate-950">Questions fréquentes</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
              <Faq q="Est-ce que ça se renouvelle tout seul ?"
                a={`Non. Vous payez chaque ${per === "mois" ? "mois" : "période"}. Sans nouveau paiement, votre compte repasse en Gratuit à la fin de la période payée.`} />
              <Faq q="Et dans l’application ?" a="Un seul compte : ce que vous payez sur le site s’ouvre aussi dans l’application." />
              {groups.buy.length ? (
                <Faq q="Qui paie la livraison offerte ?" a="Rivendy. Le vendeur reçoit toujours son prix, et le livreur est payé en entier." />
              ) : null}
              <Faq q="J’ai un abonnement Certifié ou Pro en cours ?"
                a="Il garde tous les avantages vendeur de Rivendy+ jusqu’à sa fin. Ensuite, vous passez à Rivendy+." />
            </dl>
          </section>
        </>
      )}

      {user ? (
        <p className="mt-6 text-center text-sm">
          <Link href="/plus/abonnement" className="font-extrabold text-[#00796B] underline">Mon abonnement et mes paiements</Link>
        </p>
      ) : null}
    </div>
  );
}

function BenefitCard({ icon: Icon, title, items, note }: {
  icon: typeof Check; title: string; items: string[]; note?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="flex items-center gap-2.5 text-lg font-black text-slate-950">
        <Icon className="h-[22px] w-[22px] text-[#00796B]" aria-hidden /> {title}
      </p>
      {items.length ? (
        <ul className="mt-4 space-y-2.5 text-[15px] text-slate-700">
          {items.map((b) => (
            <li key={b} className="flex gap-2.5"><Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#00796B]" aria-hidden />{b}</li>
          ))}
        </ul>
      ) : null}
      {note ? <p className={cn("text-[13px] leading-relaxed text-slate-500", items.length ? "mt-3.5" : "mt-4")}>{note}</p> : null}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-extrabold text-slate-900">{q}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{a}</dd>
    </div>
  );
}
