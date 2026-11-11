"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Lock, Package, Search, SquarePlus, Sparkles, Video, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { ContentFilter } from "@/lib/utils/content-filter";
import { cn } from "@/lib/utils/cn";
import { deleteVideo, readVideoDuration } from "@/lib/video/video-service";
import { motion, btnPrimary, btnSecondary, display } from "../play-theme";
import { EmptyState, ErrorState, PlayPage, Spinner, useLoginHref } from "../play-ui";
import {
  fetchMyArticles, requestVideoTicket, sendFreeShort, sendShortToArticle, UploadError,
} from "./create-api";
import {
  articleStatusNote, clock, CONTACT_MESSAGE, DONE_MESSAGE, filterShortArticles, freeShortCaptionProblem, megabytes, SHORT,
  SHORT_RULES, SHORT_RULES_KEY, shortFileProblem, type ShortArticle,
} from "./create-logic";
import { MY_SHORTS_PATH } from "./create-paths";
import { VideoDrop, VideoPreview } from "./create-ui";
import { handOffSellVideo } from "./sell-handoff";
import { VideoUploadCard } from "./video-upload-banner";
import { startVideoUpload, useVideoUpload, videoUploadBusy } from "./video-uploads";

/**
 * « Publier un Short » (lot 4, 2026-11-11, canevas validé) — play_short_flow.dart.
 * D'abord POUR QUOI (nouvel article, article déjà publié, Short libre), puis
 * la vidéo (30 s au plus), puis :
 *  - nouvel article : le formulaire de vente s'ouvre avec la vidéo prête
 *    (30 s, comme une vidéo créée depuis Play dans l'app) ;
 *  - article déjà publié : la vidéo devient celle de l'article (l'ancienne
 *    est supprimée chez Cloudflare) et passe dans les Shorts ;
 *  - Short libre : légende, règles acceptées, puis dépôt « à vérifier ».
 * L'app coupe les vidéos trop longues ; le site n'a pas d'outil de coupe
 * (choix validé avec le canevas) : il explique comment couper sur le téléphone.
 */

type Target = "nouvel" | "article" | "libre";
type Step = "pourquoi" | "article" | "video" | "legende" | "envoye";

const BUSY_MESSAGE = "Un envoi est déjà en cours : attendez qu’il se termine avant de publier un autre Short.";

export function ShortFlowView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const dialogs = useDialogs();
  const loginHref = useLoginHref();
  const upload = useVideoUpload();
  const [step, setStep] = useState<Step>("pourquoi");
  const [target, setTarget] = useState<Target>("libre");
  const [article, setArticle] = useState<ShortArticle | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);
  const [caption, setCaption] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);

  // Règles déjà acceptées sur cet appareil (comme l'app) : la case est cochée d'avance.
  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(SHORT_RULES_KEY) === "1");
    } catch {
      // Stockage indisponible (navigation privée) : la case reste à cocher.
    }
  }, []);

  // L'aperçu local est libéré quand la vidéo change ou que la page se ferme.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const busyNow = !!upload && (upload.phase === "uploading" || upload.phase === "retrying");
  const steps = target === "article" ? ["Pour quoi ?", "L’article", "La vidéo"]
    : target === "nouvel" ? ["Pour quoi ?", "La vidéo", "L’annonce"] : ["Pour quoi ?", "La vidéo", "Votre Short"];
  const index = step === "pourquoi" ? 0 : step === "article" ? 1 : step === "video" ? (target === "article" ? 2 : 1) : 2;

  function choose(t: Target) {
    setTarget(t);
    setProblem(null);
    setStep(t === "article" ? "article" : "video");
  }

  function back() {
    setProblem(null);
    if (step === "article") setStep("pourquoi");
    else if (step === "video") setStep(target === "article" ? "article" : "pourquoi");
    else if (step === "legende") setStep("video");
  }

  async function pickArticle(a: ShortArticle) {
    if (a.hasVideo) {
      const ok = await dialogs.confirm({
        title: "Remplacer la vidéo ?",
        message: `« ${a.title} » a déjà une vidéo. La nouvelle la remplacera, l’ancienne sera supprimée.`,
        confirmLabel: "Remplacer",
        focusCancel: true,
      });
      if (!ok) return;
    }
    setArticle(a);
    setStep("video");
  }

  async function pick(f: File) {
    setProblem(null);
    setTooLong(false);
    setChecking(true);
    try {
      const d = await readVideoDuration(f).catch(() => Number.NaN);
      const p = shortFileProblem(d);
      if (p) {
        setProblem(p);
        setTooLong(Number.isFinite(d) && d > SHORT.maxSeconds);
        return;
      }
      setFile(f);
      setDuration(d);
      setPreviewUrl(URL.createObjectURL(f));
    } finally {
      setChecking(false);
    }
  }

  function unpick() {
    setFile(null);
    setPreviewUrl(null);
    setProblem(null);
  }

  /** Lance l'envoi : l'adresse est demandée d'abord (quota, cadence : la réponse s'affiche ici). */
  async function launch(kind: "libre" | "article") {
    const f = file;
    const art = kind === "article" ? article : null;
    if (!f || (kind === "article" && !art)) return;
    if (videoUploadBusy()) {
      setProblem(BUSY_MESSAGE);
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const ticket = art ? await requestVideoTicket("product", f, { fromPlay: true }) : await requestVideoTicket("short", f);
      const text = caption;
      const started = art
        ? startVideoUpload({
          kind: "short", label: `Envoi du Short pour « ${art.title} »`,
          success: art.status === "pending" ? DONE_MESSAGE.articlePending : DONE_MESSAGE.articleOnline,
          task: (ctx, attempt) => sendShortToArticle(f, art.id, ctx, attempt === 0 ? ticket : null),
        })
        : startVideoUpload({
          kind: "short", label: "Envoi de votre Short", success: DONE_MESSAGE.freeShort, doneHref: MY_SHORTS_PATH, doneLabel: "Mes Shorts",
          task: (ctx, attempt) => sendFreeShort(f, text, ctx, attempt === 0 ? ticket : null),
        });
      if (!started) {
        void deleteVideo(ticket.cfUid).catch(() => false);
        setProblem(BUSY_MESSAGE);
        return;
      }
      setStep("envoye");
    } catch (e) {
      setProblem(e instanceof UploadError ? e.message : "L’envoi du Short a échoué, réessayez.");
    } finally {
      setSending(false);
    }
  }

  function toSell() {
    if (!file) return;
    handOffSellVideo(file);
    router.push("/sell");
  }

  function sendFree() {
    const v = ContentFilter.firstViolation(caption);
    const p = freeShortCaptionProblem(caption, () => v !== null && v !== ContentFilter.contact)
      ?? (v === ContentFilter.contact ? CONTACT_MESSAGE : null);
    if (p) {
      setProblem(p);
      return;
    }
    try {
      localStorage.setItem(SHORT_RULES_KEY, "1");
    } catch {
      // Sans stockage, les règles seront simplement redemandées la prochaine fois.
    }
    void launch("libre");
  }

  function restart() {
    setStep("pourquoi");
    setArticle(null);
    setCaption("");
    setProblem(null);
    unpick();
  }

  if (loading) return <PlayPage><Spinner /></PlayPage>;
  if (!user) {
    return (
      <PlayPage>
        <EmptyState icon={Lock} title="Connectez-vous pour publier un Short" text="Le même compte Rivendy que dans l’application.">
          <Link href={loginHref} prefetch={false} className={btnPrimary}>Se connecter</Link>
        </EmptyState>
      </PlayPage>
    );
  }

  return (
    <PlayPage>
      <header className="pb-5 pt-2 md:pt-3">
        {step === "pourquoi" || step === "envoye" ? (
          <Link href="/play" prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-rvp-soft hover:text-rvp-text">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Rivendy Play
          </Link>
        ) : (
          <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-rvp-soft hover:text-rvp-text">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Étape précédente
          </button>
        )}
        <h1 className={cn(display, "text-[30px] leading-tight text-rvp-text sm:text-[38px]")}>Publier un Short</h1>
        <p className="mt-1 text-[15px] text-rvp-soft">Jusqu’à 30 secondes, filmées ou importées.</p>
      </header>

      {step !== "envoye" ? (
        <div className="mb-5 md:hidden">
          <p className="text-[12.5px] font-bold text-rvp-soft">Étape {index + 1} sur 3 · {steps[index]}</p>
          <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-rvp-line">
            <div className="h-full rounded-full bg-rvp-accent" style={{ width: `${Math.round(((index + 1) / 3) * 100)}%` }} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <ol aria-label="Étapes" className="hidden flex-col gap-2 md:flex">
          {steps.map((s, i) => {
            const done = step === "envoye" || i < index;
            const now = step !== "envoye" && i === index;
            return (
              <li key={s} aria-current={now ? "step" : undefined}
                className={cn("flex items-center gap-3 rounded-2xl p-3", now && "border border-rvp-edge-strong bg-rvp-surface")}>
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold",
                  done ? "bg-rvp-accent/15 text-rvp-accent" : now ? "bg-rvp-accent text-rvp-on-accent" : "bg-rvp-raised text-rvp-muted")}>
                  {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn("text-[14.5px] font-semibold", now || done ? "text-rvp-text" : "text-rvp-muted")}>{s}</span>
              </li>
            );
          })}
        </ol>

        <div className="min-w-0 max-w-xl">
          {busyNow && step !== "envoye" ? (
            <div className="mb-5 flex flex-col gap-3">
              <p className="rounded-xl bg-amber-300/10 px-3.5 py-2.5 text-[14px] leading-snug text-amber-100">{BUSY_MESSAGE}</p>
              <VideoUploadCard />
            </div>
          ) : null}

          {step === "pourquoi" ? (
            <div className="flex flex-col gap-3">
              <h2 className={cn(display, "text-[24px] text-rvp-text")}>Pour quoi ?</h2>
              <Choice icon={SquarePlus} title="Pour un nouvel article" text="Filmez, puis complétez l’annonce : photo, prix, catégorie." onClick={() => choose("nouvel")} />
              <Choice icon={Package} title="Pour un de mes articles" text="La vidéo s’ajoute à un article déjà publié." onClick={() => choose("article")} />
              <Choice icon={Sparkles} title="Short libre" text="Sans article à vendre. Rivendy le vérifie avant de le publier." onClick={() => choose("libre")} />
              <p className="px-1 text-[12.5px] leading-5 text-rvp-muted">Le nombre de vidéos par mois dépend de votre formule vendeur : vidéos d’articles et Shorts comptent ensemble.</p>
            </div>
          ) : step === "article" ? (
            <ArticlePicker onPick={(a) => void pickArticle(a)} onNewArticle={() => choose("nouvel")} />
          ) : step === "video" ? (
            <div className="flex flex-col gap-4">
              <h2 className={cn(display, "text-[24px] text-rvp-text")}>La vidéo</h2>
              <p className="-mt-2 text-[14px] leading-snug text-rvp-soft">
                {target === "nouvel" ? "Ensuite, l’annonce s’ouvre avec la vidéo prête : photo, prix, catégorie."
                  : target === "article" ? `Elle devient la vidéo de « ${article?.title ?? "l’article"} » et passe dans les Shorts.`
                    : "Filmez ou importez jusqu’à 30 secondes."}
              </p>
              {file && previewUrl ? (
                <VideoPreview url={previewUrl} shape="tall" durationLabel={clock(duration)} sizeLabel={megabytes(file.size)} onChange={unpick} />
              ) : (
                <VideoDrop shape="tall" busy={checking} onFile={(f) => void pick(f)} title="Choisir une vidéo"
                  hint="30 secondes au plus · format vertical conseillé"
                  note="Sur iPhone : Photothèque, Prendre une vidéo ou Fichiers." />
              )}
              {problem ? (
                <div role="alert" className="rounded-xl bg-red-500/12 px-3.5 py-3 text-[14px] leading-snug text-red-100">
                  <p className="font-semibold">{problem}</p>
                  {tooLong ? (
                    <p className="mt-1.5 text-[13.5px] text-red-100/90">
                      Coupez-la sur votre téléphone, puis choisissez-la à nouveau.<br />
                      iPhone : Photos → la vidéo → Modifier → faites glisser les bords.<br />
                      Android : Galerie → la vidéo → Modifier → Couper.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {file ? (
                target === "nouvel" ? (
                  <button type="button" onClick={toSell} className={cn(btnPrimary, "h-12")}>Continuer vers l’annonce</button>
                ) : target === "article" ? (
                  <button type="button" onClick={() => void launch("article")} disabled={sending} className={cn(btnPrimary, "h-12")}>
                    {sending ? "Un instant…" : "Envoyer"}
                  </button>
                ) : (
                  <button type="button" onClick={() => { setProblem(null); setStep("legende"); }} className={cn(btnPrimary, "h-12")}>Continuer</button>
                )
              ) : null}
            </div>
          ) : step === "legende" ? (
            <form onSubmit={(e) => { e.preventDefault(); sendFree(); }} className="flex flex-col gap-4">
              <div>
                <h2 className={cn(display, "text-[24px] text-rvp-text")}>Votre Short</h2>
                <p className="mt-0.5 text-[14px] text-rvp-soft">Rivendy le vérifie avant de le publier.</p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="sr-only">Légende du Short</span>
                <textarea value={caption} maxLength={SHORT.captionMax} rows={3} placeholder="Une légende (facultative)"
                  onChange={(e) => { setCaption(e.target.value); if (problem) setProblem(null); }}
                  className="resize-none rounded-xl border border-rvp-edge bg-rvp-raised px-3.5 py-3 text-[16px] leading-relaxed text-rvp-text placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none focus:ring-2 focus:ring-rvp-accent/25" />
                <span className="self-end text-[12px] text-rvp-muted">{caption.trim().length} / {SHORT.captionMax}</span>
              </label>
              <div>
                <h3 className="text-[16px] font-bold text-rvp-text">Règles de publication</h3>
                <ul className="mt-2 space-y-2">
                  {SHORT_RULES.map((r) => (
                    <li key={r} className="flex gap-2.5 text-[14px] leading-snug text-rvp-soft">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden /> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <label className="flex min-h-11 items-start gap-3 text-[14px] leading-snug text-rvp-text">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--rvp-accent)]" />
                J’accepte ces règles. Un Short qui ne les respecte pas est refusé ou retiré.
              </label>
              {problem ? <p role="alert" className="rounded-xl bg-red-500/12 px-3.5 py-2.5 text-[14px] leading-snug text-red-100">{problem}</p> : null}
              <button type="submit" disabled={!accepted || sending} className={cn(btnPrimary, "h-12")}>
                {sending ? "Un instant…" : "Envoyer pour vérification"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className={cn(display, "text-[24px] text-rvp-text")}>Envoi en cours</h2>
              <p className="text-[15px] leading-relaxed text-rvp-soft">
                Vous pouvez continuer à utiliser Rivendy pendant l’envoi. Gardez cet onglet ouvert jusqu’au message de fin : une coupure de réseau ne fait pas tout recommencer.
              </p>
              <VideoUploadCard kind="short" />
              <div className="flex flex-wrap gap-3">
                {target === "libre" ? <Link href={MY_SHORTS_PATH} prefetch={false} className={cn(btnPrimary, "h-12")}>Mes Shorts</Link> : null}
                <Link href="/play" prefetch={false} className={cn(btnSecondary, "h-12")}>Retour à Play</Link>
                <button type="button" onClick={restart} className={cn(btnSecondary, "h-12")}>Publier un autre Short</button>
              </div>
            </div>
          )}

          {problem && (step === "pourquoi" || step === "article") ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-500/12 px-3.5 py-2.5 text-[14px] leading-snug text-red-100">{problem}</p>
          ) : null}
        </div>
      </div>
    </PlayPage>
  );
}

function Choice({ icon: Icon, title, text, onClick }: { icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex items-center gap-3.5 rounded-[18px] border border-rvp-edge bg-rvp-surface p-3.5 text-left text-rvp-text hover:border-rvp-edge-strong hover:bg-rvp-raised", motion)}>
      <span aria-hidden className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-rvp-accent/15 text-rvp-accent-hover">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] leading-snug text-rvp-soft">{text}</span>
      </span>
    </button>
  );
}

/** Tous les articles du vendeur (en vente, en attente, boostés, épuisés), avec recherche et « Sans vidéo ». */
function ArticlePicker({ onPick, onNewArticle }: { onPick: (a: ShortArticle) => void; onNewArticle: () => void }) {
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ round: number; articles: ShortArticle[] | null } | null>(null);
  const [query, setQuery] = useState("");
  const [withoutVideo, setWithoutVideo] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyArticles().then((a) => { if (alive) setData({ round, articles: a }); }, () => { if (alive) setData({ round, articles: null }); });
    return () => { alive = false; };
  }, [round]);

  const current = data && data.round === round ? data : null;
  const all = current?.articles ?? [];
  const visible = filterShortArticles(all, query, withoutVideo);

  return (
    <div className="flex flex-col gap-4">
      <h2 className={cn(display, "text-[24px] text-rvp-text")}>Choisir l’article{all.length > 0 ? ` (${all.length})` : ""}</h2>
      {!current ? <Spinner label="Chargement de vos articles…" /> : current.articles === null ? (
        <ErrorState text="Impossible de charger vos articles. Vérifiez votre connexion." onRetry={() => setRound((n) => n + 1)} />
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-rvp-edge bg-rvp-surface p-5 text-center">
          <p className="text-[14.5px] leading-relaxed text-rvp-soft">Vous n’avez aucun article en vente sur ce compte.</p>
          <button type="button" onClick={onNewArticle} className={cn(btnPrimary, "mt-4 h-11")}>Pour un nouvel article</button>
        </div>
      ) : (
        <>
          {all.length > 1 ? (
            <div className="flex flex-col gap-2.5">
              <label className="flex h-12 items-center gap-2.5 rounded-xl border border-rvp-edge bg-rvp-raised px-3.5 text-rvp-muted focus-within:border-rvp-accent">
                <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un article" aria-label="Rechercher un article"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-rvp-text placeholder:text-rvp-muted focus:outline-none" />
              </label>
              <label className="inline-flex min-h-11 items-center gap-2.5 self-start text-[14px] font-semibold text-rvp-text">
                <input type="checkbox" checked={withoutVideo} onChange={(e) => setWithoutVideo(e.target.checked)} className="h-5 w-5 accent-[var(--rvp-accent)]" />
                Sans vidéo
              </label>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-rvp-surface p-5 text-center text-[14.5px] text-rvp-soft">Aucun article ne correspond.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {visible.map((a) => {
                const note = articleStatusNote(a.status);
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => onPick(a)}
                      aria-label={`${a.title}${note ? `, ${note}` : ""}${a.hasVideo ? ", a déjà une vidéo" : ""}`}
                      className="group flex w-full flex-col gap-1.5 text-left">
                      <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-rvp-edge bg-rvp-raised group-hover:border-rvp-edge-strong">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {a.photo ? <img src={a.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
                        {a.hasVideo ? (
                          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                            <Video className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        ) : null}
                        {note ? <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10.5px] font-semibold text-white">{note}</span> : null}
                      </span>
                      <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-rvp-text">{a.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
