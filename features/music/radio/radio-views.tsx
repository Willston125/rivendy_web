"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Lock, Play, Radio, Square } from "lucide-react";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import { fetchRadioPreview, fetchRadios } from "./radio-api";
import { groupRadiosByRegion, type RadioStation } from "./radio-logic";
import { LiveBadge, RadioLogo, useRadioPlayer } from "./radio-player";

/**
 * Page « Radio » de la Musique (2026-11-11, canevas validé) : les radios en
 * ligne du marché, par rubrique. Aucune radio inventée : sans radio en
 * ligne, la page le dit.
 */
export function RadioPage() {
  const { country } = useCountry();
  const market = country?.id ?? null;
  const [radios, setRadios] = useState<RadioStation[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRadios(await fetchRadios(market));
    } catch {
      setFailed(true);
    }
  }, [market]);

  // Rendu différé (react-hooks/set-state-in-effect).
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  const groups = radios ? groupRadiosByRegion(radios) : [];
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex max-w-3xl flex-col gap-2">
        <LiveBadge className="w-fit" />
        <h1 className="font-rvm-display text-[clamp(2rem,5cqw,2.75rem)] font-black leading-tight">Radio en direct</h1>
        <p className="text-base text-rvm-soft">
          Les radios des Comores et de l’océan Indien, gratuites, diffusées avec l’accord de chaque station.
        </p>
      </header>

      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-rvm-raised p-5">
          <p className="font-semibold">Impossible de charger les radios.</p>
          <p className="text-sm text-rvm-soft">Vérifiez votre connexion, puis réessayez.</p>
          <button type="button" onClick={() => void load()}
            className="rounded-full bg-rvm-deep px-4 py-2 text-sm font-semibold text-white hover:bg-rvm-deep-2">Réessayer</button>
        </div>
      ) : radios === null ? (
        <p className="flex items-center gap-2 text-sm text-rvm-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…</p>
      ) : groups.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-2 rounded-2xl bg-rvm-raised p-6">
          <Radio className="h-8 w-8 text-rvm-ink-accent" aria-hidden />
          <p className="font-rvm-display text-xl font-extrabold">Les radios en direct arrivent bientôt</p>
          <p className="text-sm text-rvm-soft">Chaque radio rejoint Rivendy avec l’accord de sa station.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.region} aria-labelledby={`radio-${g.region}`} className="flex flex-col gap-4">
            <h2 id={`radio-${g.region}`} className="font-rvm-display text-2xl font-extrabold">{g.label}</h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
              {g.stations.map((s) => <li key={s.id}><RadioTile station={s} /></li>)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function RadioTile({ station }: { station: RadioStation }) {
  const r = useRadioPlayer();
  const current = r.station?.id === station.id;
  const on = current && r.playing;
  return (
    <button type="button" onClick={() => (current ? r.toggle() : r.play(station))}
      aria-label={on ? `Arrêter ${station.name}` : `Écouter ${station.name}`}
      className="group flex w-full flex-col gap-2 text-left">
      <span className={cn("relative block aspect-square w-full overflow-hidden rounded-2xl",
        current && "outline outline-4 -outline-offset-4 outline-rvm-accent")}>
        <RadioLogo station={station} className="h-full w-full rounded-2xl text-2xl" />
        <span aria-hidden className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-rvm-accent text-rvm-on-accent opacity-90 shadow-md transition group-hover:opacity-100">
          {current && r.loading ? <Loader2 className="h-5 w-5 animate-spin" />
            : on ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </span>
      </span>
      <span className="truncate text-[15px] font-bold">{station.name}</span>
      <span className={cn("truncate text-[13px]", on ? "font-semibold text-rvm-eq" : "text-rvm-muted")}>
        {on ? "En lecture" : station.place ?? " "}
      </span>
    </button>
  );
}

/**
 * Aperçu privé d'une station (2026-11-11) : la station entend sa radio dans
 * Rivendy avant de signer. La page n'est listée nulle part (noindex) ; le
 * lien secret est le seul chemin. Aucun compte demandé, aucune écoute comptée.
 */
export function RadioPreviewPage({ token }: { token: string }) {
  const r = useRadioPlayer();
  const [station, setStation] = useState<RadioStation | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(async () => {
      try {
        const s = await fetchRadioPreview(token);
        if (alive) setStation(s);
      } catch {
        if (alive) setFailed(true);
      }
    });
    return () => { alive = false; };
  }, [token]);

  if (failed) {
    return <PreviewMessage title="Aperçu indisponible pour le moment" text="Vérifiez votre connexion, puis rechargez la page." />;
  }
  if (station === undefined) {
    return <p className="flex items-center gap-2 px-6 py-10 text-sm text-rvm-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…</p>;
  }
  if (station === null) {
    return <PreviewMessage title="Ce lien d’aperçu n’est plus valable" text="Demandez à Rivendy un nouveau lien." />;
  }
  const current = r.station?.id === station.id;
  const on = current && r.playing;
  return (
    <div className="flex flex-col">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
        <Lock className="h-4 w-4" aria-hidden />
        <strong>Aperçu privé</strong>
        <span>Cette page n’est visible que par {station.name}. Elle n’apparaît ni dans Rivendy ni dans les moteurs de recherche.</span>
      </p>
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap gap-8 px-6 py-10">
        <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <p className="text-sm font-bold uppercase tracking-wider text-rvm-ink-accent">Rivendy Musique · Radio en direct</p>
          <h1 className="font-rvm-display text-[clamp(2rem,5cqw,2.75rem)] font-black leading-tight">Votre radio est prête dans Rivendy</h1>
          <p className="max-w-xl text-base text-rvm-soft">
            Voici {station.name} telle que la verront nos auditeurs, dans l’application et sur www.rivendy.com.
            Appuyez sur lecture : c’est votre direct, sans aucune modification.
          </p>
          <div className="rvm-scope rvm-deep flex flex-wrap items-center gap-5 rounded-3xl p-5 text-rvm-text">
            <RadioLogo station={station} className="h-28 w-28 rounded-2xl text-3xl" />
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
              <LiveBadge className="w-fit" />
              <p className="truncate font-rvm-display text-2xl font-black">{station.name}</p>
              <p className="text-sm text-rvm-soft" role="status">
                {current ? (r.error ?? (r.loading ? "Connexion à la radio…" : on ? "En direct" : "En pause")) : station.place ?? "Prête à jouer"}
              </p>
            </div>
            <button type="button" onClick={() => (current ? r.toggle() : r.play(station, { preview: true }))}
              aria-label={on ? `Arrêter ${station.name}` : `Écouter ${station.name}`}
              className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-rvm-accent text-rvm-on-accent hover:bg-rvm-accent-hover">
              {current && r.loading && !r.error ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
                : on ? <Square className="h-6 w-6 fill-current" aria-hidden /> : <Play className="h-7 w-7 fill-current" aria-hidden />}
            </button>
          </div>
          <ol className="flex flex-col gap-3">
            {[
              "Écoutez votre radio ici, sur votre téléphone ou votre ordinateur.",
              "Signez la lettre d’accord d’une page que nous vous avons envoyée.",
              "Nous l’ouvrons à tous nos auditeurs le jour même.",
            ].map((text, i) => (
              <li key={text} className="flex items-start gap-3">
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rvm-deep font-rvm-display font-black text-rvm-accent">{i + 1}</span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ol>
        </section>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 self-start rounded-3xl border border-rvm-line bg-rvm-surface p-6">
          <h2 className="font-rvm-display text-xl font-extrabold">Ce que vous y gagnez</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-rvm-soft">
            <li>De nouveaux auditeurs aux Comores et dans la diaspora.</li>
            <li>Votre nom, votre logo et un lien vers votre site.</li>
            <li>Votre son tel quel : aucune publicité ajoutée, rien de coupé.</li>
            <li>Vos chiffres d’écoute dans Rivendy, chaque mois.</li>
            <li>Gratuit, et vous pouvez vous retirer à tout moment.</li>
          </ul>
          {station.homepage_url ? (
            <a href={station.homepage_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-rvm-ink-accent underline">
              Votre site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function PreviewMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-2 px-6 py-16">
      <h1 className="font-rvm-display text-2xl font-extrabold">{title}</h1>
      <p className="text-rvm-soft">{text}</p>
      <Link href="/music" className="mt-2 w-fit text-sm font-semibold text-rvm-ink-accent underline">Découvrir Rivendy Musique</Link>
    </div>
  );
}
