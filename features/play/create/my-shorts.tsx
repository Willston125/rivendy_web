"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Eye, Lock, MessageCircle, Plus, SquarePlay, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { btnPrimary, display } from "../play-theme";
import { EmptyState, ErrorState, PlayPage, Spinner, useLoginHref } from "../play-ui";
import { deleteMyShort, fetchMyShorts, setCommentsMode, type MyShort } from "./create-api";
import { commentsModeLabel, shortIsOnline, shortStatusLabel, shortStatusTone, type CommentsMode } from "./create-logic";
import { SHORT_NEW_PATH, shortPublicPath } from "./create-paths";
import { CommentsModeSheet, RowMenu, StatusChip, type RowAction } from "./create-ui";
import { VideoUploadCard } from "./video-upload-banner";
import { onVideoUploadSettled } from "./video-uploads";

/**
 * « Mes Shorts » (lot 4, 2026-11-11) — my_shorts_screen.dart : les Shorts
 * libres du compte, tous statuts (en vérification, en ligne, refusés,
 * retirés), avec « Voir et partager », « Qui peut commenter » et
 * « Supprimer ». Les vidéos des articles se gèrent dans l'espace vendeur.
 * Le site n'a pas de fil Shorts : ils se regardent dans l'application et
 * par leur lien partagé (/play/short/public/…).
 */
export function MyShortsView() {
  const { user, loading } = useAuth();
  const dialogs = useDialogs();
  const loginHref = useLoginHref();
  const userId = user?.id ?? null;
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ round: number; shorts: MyShort[] | null } | null>(null);
  const [comments, setComments] = useState<{ id: string; mode: CommentsMode } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchMyShorts().then((s) => { if (alive) setData({ round, shorts: s }); }, () => { if (alive) setData({ round, shorts: null }); });
    return () => { alive = false; };
  }, [userId, round]);

  // Un Short vient d'être envoyé : la liste se relit.
  useEffect(() => onVideoUploadSettled((u) => { if (u.kind === "short" && u.phase === "done") setRound((n) => n + 1); }), []);

  const reload = () => setRound((n) => n + 1);
  const current = data && data.round === round ? data : null;

  async function remove(s: MyShort) {
    const ok = await dialogs.confirm({ title: "Supprimer ce Short ?", message: "La vidéo sera supprimée définitivement.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    const deleted = await deleteMyShort(s.id).catch(() => false);
    dialogs.notify(deleted ? "Short supprimé." : "Suppression impossible pour le moment.", deleted ? "success" : "error");
    if (deleted) reload();
  }

  async function pickComments(mode: CommentsMode) {
    const target = comments;
    setComments(null);
    if (!target || mode === target.mode) return;
    const saved = await setCommentsMode("user_short", target.id, mode);
    dialogs.notify(saved ? `Commentaires : ${commentsModeLabel(mode).toLowerCase()}.` : "Réglage impossible pour le moment.", saved ? "success" : "error");
    if (saved) reload();
  }

  return (
    <PlayPage>
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-3 md:pt-4">
        <div className="min-w-0">
          <h1 className={cn(display, "flex items-center gap-3 text-[30px] leading-tight text-rvp-text sm:text-[38px]")}>
            <SquarePlay className="h-8 w-8 text-rvp-accent" aria-hidden /> Mes Shorts
          </h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-rvp-soft">
            Vos Shorts libres. Ils se regardent dans l’application Rivendy et par lien partagé ; les vidéos de vos articles se gèrent dans{" "}
            <Link href="/seller" prefetch={false} className="font-semibold text-rvp-accent hover:underline">votre espace vendeur</Link>.
          </p>
        </div>
        {user ? (
          <Link href={SHORT_NEW_PATH} prefetch={false} className={cn(btnPrimary, "h-12")}>
            <Plus className="h-5 w-5" aria-hidden /> Publier un Short
          </Link>
        ) : null}
      </header>

      {loading ? <Spinner /> : !user ? (
        <EmptyState icon={Lock} title="Connectez-vous pour voir vos Shorts" text="Le même compte Rivendy que dans l’application.">
          <Link href={loginHref} prefetch={false} className={btnPrimary}>Se connecter</Link>
        </EmptyState>
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          <VideoUploadCard kind="short" />
          {!current ? <Spinner /> : current.shorts === null ? (
            <ErrorState text="Impossible de charger vos Shorts. Vérifiez votre connexion." onRetry={reload} />
          ) : current.shorts.length === 0 ? (
            <EmptyState icon={SquarePlay} title="Aucun Short libre pour le moment" text="Vous n’avez pas encore publié de Short libre.">
              <Link href={SHORT_NEW_PATH} prefetch={false} className={btnPrimary}>Publier un Short</Link>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {current.shorts.map((s) => {
                const online = shortIsOnline(s);
                const label = shortStatusLabel(s);
                // Image seulement une fois en ligne : avant, la vidéo est protégée (lecture par jeton).
                const thumb = online && s.thumbnail_url?.startsWith("https://") ? s.thumbnail_url : null;
                const actions: RowAction[] = [
                  ...(online ? [{ label: "Voir et partager", icon: Eye, href: shortPublicPath(s.id) }] : []),
                  { label: "Qui peut commenter", icon: MessageCircle, onSelect: () => setComments({ id: s.id, mode: s.comments_mode }) },
                  { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => void remove(s) },
                ];
                return (
                  <li key={s.id} className="flex items-start gap-3 rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-2.5">
                    <span className="relative grid h-24 w-[54px] shrink-0 place-items-center overflow-hidden rounded-lg bg-rvp-raised text-rvp-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {thumb ? <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <Clock className="h-5 w-5" aria-hidden />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                      <span className={cn("line-clamp-2 text-[14.5px] font-semibold leading-snug", s.caption ? "text-rvp-text" : "text-rvp-soft")}>
                        {s.caption || "Sans légende"}
                      </span>
                      <span><StatusChip tone={shortStatusTone(s)}>{label}</StatusChip></span>
                      {s.moderation_reason ? <span className="text-[12.5px] leading-snug text-red-200">Motif : {s.moderation_reason}</span> : null}
                      <span className="text-[12.5px] text-rvp-muted">
                        {s.comments_count > 0 ? `${s.comments_count} commentaire${s.comments_count > 1 ? "s" : ""} · ` : ""}
                        Commentaires : {commentsModeLabel(s.comments_mode).toLowerCase()}
                      </span>
                    </span>
                    <RowMenu label="Options du Short" actions={actions} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {comments ? <CommentsModeSheet current={comments.mode} onPick={(m) => void pickComments(m)} onClose={() => setComments(null)} /> : null}
    </PlayPage>
  );
}
