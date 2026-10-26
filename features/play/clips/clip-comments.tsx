"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisVertical, Flag, Heart, Loader2, MessageCircle, Pin, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { ContentFilter } from "@/lib/utils/content-filter";
import { cn } from "@/lib/utils/cn";
import { btnSecondary, display, motion } from "../play-theme";
import {
  COMMENTS_MAX, addComment, deleteComment, fetchBlockedIds, fetchComments, fetchLikedComments, replyComment, reportComment,
  setCommentLiked,
} from "./clips-api";
import { artistInitials, commentErrorMessage, commentThreads, commentsModeNotice, relativeDate, type ClipComment } from "./clips-logic";

/**
 * Commentaires d'un clip (refonte Clips du 2026-10-26) : les mêmes que dans
 * l'app (`play_short_comments` et ses fonctions) — publier, répondre, aimer,
 * supprimer le sien, signaler (masqué tout de suite, Rivendy tranche). Le
 * serveur décide de tout (connexion, règles de l'artiste, anti-contact) ; le
 * site prévient seulement d'avance. Sur téléphone, un aperçu replié.
 */
export function ClipComments({ titleId, commentsMode, ownerId, initialCount, collapsible }: {
  titleId: string; commentsMode: string | null | undefined; ownerId: string | null; initialCount: number; collapsible?: boolean;
}) {
  const { user } = useAuth();
  const { notify, confirm } = useDialogs();
  const pathname = usePathname() || "/play/clips";
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; comments: ClipComment[] | null } | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(!collapsible);
  const [replyTo, setReplyTo] = useState<ClipComment | null>(null);
  const key = `${titleId}:${round}`;
  const userId = user?.id ?? null;

  useEffect(() => {
    let alive = true;
    void fetchComments(titleId)
      .then((c) => { if (alive) setData({ key, comments: c }); })
      .catch(() => { if (alive) setData({ key, comments: null }); });
    return () => { alive = false; };
  }, [titleId, key]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchBlockedIds().then((b) => { if (alive) setBlocked(b); });
    return () => { alive = false; };
  }, [userId]);

  const current = data && data.key === key ? data : null;
  const comments = useMemo(() => current?.comments ?? [], [current]);
  const commentIds = comments.map((c) => c.id).join(",");
  useEffect(() => {
    if (!userId || !commentIds) return;
    let alive = true;
    void fetchLikedComments(commentIds.split(",")).then((s) => { if (alive) setLiked(s); });
    return () => { alive = false; };
  }, [userId, commentIds]);

  const threads = useMemo(() => commentThreads(comments, blocked), [comments, blocked]);
  const count = current?.comments ? threads.reduce((n, t) => n + 1 + t.replies.length, 0) : initialCount;
  const notice = commentsModeNotice(commentsMode);
  const loginHref = `/auth/login?next=${encodeURIComponent(pathname)}`;

  const patch = (id: string, fn: (c: ClipComment) => ClipComment | null) =>
    setData((d) => (d && d.comments ? { ...d, comments: d.comments.flatMap((c) => { if (c.id !== id) return [c]; const n = fn(c); return n ? [n] : []; }) } : d));

  const toggleLike = async (c: ClipComment) => {
    if (!userId) { notify("Connectez-vous pour aimer un commentaire.", "info"); return; }
    const on = !liked.has(c.id);
    setLiked((s) => { const n = new Set(s); if (on) n.add(c.id); else n.delete(c.id); return n; });
    const total = await setCommentLiked(c.id, on);
    if (total == null) {
      setLiked((s) => { const n = new Set(s); if (on) n.delete(c.id); else n.add(c.id); return n; });
      notify("Action impossible pour le moment.", "error");
      return;
    }
    patch(c.id, (x) => ({ ...x, likes_count: total }));
  };

  const remove = async (c: ClipComment) => {
    if (!(await confirm({ title: "Supprimer ce commentaire ?", message: "Il disparaît pour tout le monde, sur le site et dans l’application.", confirmLabel: "Supprimer", danger: true }))) return;
    if (await deleteComment(c.id)) {
      setData((d) => (d && d.comments ? { ...d, comments: d.comments.filter((x) => x.id !== c.id && x.parent_id !== c.id) } : d));
      notify("Commentaire supprimé.", "success");
    } else notify("Suppression impossible pour le moment.", "error");
  };

  const report = async (c: ClipComment) => {
    if (!userId) { notify("Connectez-vous pour signaler un commentaire.", "info"); return; }
    if (!(await confirm({ title: "Signaler ce commentaire ?", message: "Il est masqué tout de suite ; Rivendy vérifie et décide.", confirmLabel: "Signaler" }))) return;
    if (await reportComment(c.id)) {
      patch(c.id, () => null);
      notify("Merci, le commentaire est signalé.", "success");
    } else notify("Signalement impossible pour le moment.", "error");
  };

  const shown = open ? threads : threads.slice(0, 1);

  return (
    <section aria-labelledby={`commentaires-${titleId}`}
      className={cn("mt-6", collapsible && "rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-4 @min-[64rem]:border-0 @min-[64rem]:bg-transparent @min-[64rem]:p-0")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`commentaires-${titleId}`} className={cn(display, "text-[19px] font-bold text-rvp-text")}>
          Commentaires{count > 0 ? <span className="ml-2 text-[15px] font-semibold text-rvp-muted">{count}</span> : null}
        </h2>
        {collapsible && !open && threads.length > 0 ? (
          <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-rvp px-2 text-sm font-semibold text-rvp-accent hover:underline">
            Voir tout
          </button>
        ) : null}
      </div>

      {notice ? <p className="mt-2 text-[13px] text-rvp-muted">{notice}</p> : null}

      {commentsMode !== "none" ? (
        userId ? (
          <Composer key={replyTo?.id ?? "racine"} titleId={titleId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
            onPosted={(c) => {
              setData((d) => (d && d.comments ? { ...d, comments: [c, ...d.comments] } : d));
              setReplyTo(null);
              setOpen(true);
            }} />
        ) : (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-rvp bg-rvp-raised/60 px-3.5 py-3 text-sm text-rvp-soft">
            Connectez-vous pour commenter : vous revenez ensuite sur ce clip.
            <Link href={loginHref} prefetch={false} className="font-semibold text-rvp-accent hover:underline">Se connecter</Link>
          </p>
        )
      ) : null}

      {!current ? (
        <div role="status" className="mt-5 space-y-4" aria-label="Chargement des commentaires">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3"><span className="rvp-skeleton h-9 w-9 rounded-full" /><span className="flex-1 space-y-2"><span className="rvp-skeleton block h-3.5 w-1/3 rounded" /><span className="rvp-skeleton block h-3.5 w-4/5 rounded" /></span></div>
          ))}
        </div>
      ) : current.comments === null ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-rvp-soft">
          Impossible de charger les commentaires.
          <button type="button" onClick={() => setRound((n) => n + 1)} className={cn(btnSecondary, "h-10 px-4 text-sm")}>Réessayer</button>
        </div>
      ) : threads.length === 0 ? (
        <p className="mt-4 text-sm text-rvp-muted">{commentsMode === "none" ? "Aucun commentaire." : "Aucun commentaire pour le moment. Soyez le premier à réagir."}</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {shown.map(({ comment, replies }) => (
            <li key={comment.id}>
              <CommentItem c={comment} mine={comment.author_id === userId} owner={comment.author_id === ownerId} liked={liked.has(comment.id)}
                onLike={() => void toggleLike(comment)} onDelete={() => void remove(comment)} onReport={() => void report(comment)}
                onReply={userId && commentsMode !== "none" ? () => setReplyTo(comment) : undefined} />
              {replies.length > 0 && open ? (
                <ul className="ml-12 mt-3 space-y-3 border-l border-rvp-line pl-4">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem c={r} small mine={r.author_id === userId} owner={r.author_id === ownerId} liked={liked.has(r.id)}
                        onLike={() => void toggleLike(r)} onDelete={() => void remove(r)} onReport={() => void report(r)}
                        onReply={userId && commentsMode !== "none" ? () => setReplyTo(comment) : undefined} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {collapsible && !open && threads.length > 1 ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 h-10 text-sm font-semibold text-rvp-accent hover:underline">
          Voir les {count} commentaires
        </button>
      ) : null}
      {current?.comments && current.comments.length >= COMMENTS_MAX ? (
        <p className="mt-4 text-[12.5px] text-rvp-muted">Les {COMMENTS_MAX} commentaires les plus récents.</p>
      ) : null}
    </section>
  );
}

function Composer({ titleId, replyTo, onPosted, onCancelReply }: {
  titleId: string; replyTo: ClipComment | null; onPosted: (c: ClipComment) => void; onCancelReply: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (replyTo) ref.current?.focus(); }, [replyTo]);

  const send = async () => {
    const body = text.trim();
    if (body.length < 2) { setError(commentErrorMessage("bad_length")); return; }
    if (ContentFilter.firstViolation(body)) { setError(ContentFilter.messageFor(body)); return; }
    setBusy(true);
    setError(null);
    const res = replyTo ? await replyComment(replyTo.parent_id ?? replyTo.id, body) : await addComment(titleId, body);
    setBusy(false);
    if (!res.ok) { setError(commentErrorMessage(res.error)); return; }
    setText("");
    onPosted(res.comment);
  };

  return (
    <form className="mt-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {replyTo ? (
        <p className="mb-1.5 flex items-center gap-2 text-[12.5px] text-rvp-muted">
          Réponse à <span className="font-semibold text-rvp-soft">{replyTo.author_name}</span>
          <button type="button" onClick={onCancelReply} className="font-semibold text-rvp-accent hover:underline">Annuler</button>
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor={`commentaire-${titleId}`} className="sr-only">{replyTo ? "Votre réponse" : "Ajouter un commentaire"}</label>
        <textarea id={`commentaire-${titleId}`} ref={ref} rows={1} value={text} maxLength={500}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={replyTo ? "Votre réponse…" : "Ajouter un commentaire…"}
          className="min-h-11 flex-1 resize-none rounded-rvp border border-rvp-edge bg-rvp-raised px-3.5 py-2.5 text-[15px] text-rvp-text placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none" />
        <button type="submit" disabled={busy || text.trim().length < 2} aria-label="Publier le commentaire"
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-rvp bg-rvp-accent text-rvp-on-accent hover:bg-rvp-accent-hover disabled:cursor-not-allowed disabled:opacity-50", motion)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {error ? <p role="alert" className="mt-1.5 text-[13px] text-amber-300">{error}</p> : null}
    </form>
  );
}

function CommentItem({ c, mine, owner, liked, small, onLike, onDelete, onReport, onReply }: {
  c: ClipComment; mine: boolean; owner: boolean; liked: boolean; small?: boolean;
  onLike: () => void; onDelete: () => void; onReport: () => void; onReply?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [now] = useState(() => new Date());
  const wrap = useRef<HTMLSpanElement>(null);
  // Clic ou toucher hors du menu, Échap : il se referme (Safari ne donne pas le focus aux boutons).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menu]);
  return (
    <article className="flex gap-3">
      <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-rvp-raised font-bold text-rvp-soft", small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-[12px]")}>
        {artistInitials(c.author_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className={cn("font-semibold", owner ? "rounded bg-rvp-accent/15 px-1.5 text-rvp-accent" : "text-rvp-text")}>{c.author_name}</span>
          {owner ? <span className="sr-only">(artiste)</span> : null}
          <span className="text-rvp-muted">{relativeDate(c.created_at, now)}</span>
          {c.pinned_at ? <span className="inline-flex items-center gap-1 text-[12px] text-rvp-muted"><Pin className="h-3 w-3" aria-hidden /> Épinglé par l’artiste</span> : null}
        </p>
        <p className="mt-0.5 whitespace-pre-line break-words text-[14.5px] leading-6 text-rvp-soft">{c.body}</p>
        <div className="mt-1 flex items-center gap-1 text-[12.5px] text-rvp-muted">
          <button type="button" onClick={onLike} aria-pressed={liked} aria-label={liked ? "Ne plus aimer ce commentaire" : "Aimer ce commentaire"}
            className={cn("flex h-9 items-center gap-1.5 rounded-full px-2 hover:bg-white/[0.05]", liked && "text-rvp-accent")}>
            <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden />
            {c.likes_count > 0 ? <span className="tabular-nums">{c.likes_count}</span> : null}
          </button>
          {c.creator_liked ? <span className="px-1 text-rvp-accent" title="Aimé par l’artiste">♥ par l’artiste</span> : null}
          {onReply ? (
            <button type="button" onClick={onReply} className="flex h-9 items-center gap-1.5 rounded-full px-2 font-semibold hover:bg-white/[0.05] hover:text-rvp-text">
              <MessageCircle className="h-4 w-4" aria-hidden /> Répondre
            </button>
          ) : null}
          <span ref={wrap} className="relative ml-auto">
            <button type="button" aria-haspopup="menu" aria-expanded={menu} aria-label="Plus d’actions sur ce commentaire"
              onClick={() => setMenu((m) => !m)}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.05] hover:text-rvp-text">
              <EllipsisVertical className="h-4 w-4" aria-hidden />
            </button>
            {menu ? (
              <span role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-rvp border border-rvp-edge bg-rvp-raised p-1 shadow-rvp-deep">
                {mine ? (
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(); }}
                    className="flex h-10 w-full items-center gap-2 rounded-rvp-sm px-2.5 text-left text-sm text-rvp-soft hover:bg-white/[0.06] hover:text-rvp-text">
                    <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
                  </button>
                ) : (
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); onReport(); }}
                    className="flex h-10 w-full items-center gap-2 rounded-rvp-sm px-2.5 text-left text-sm text-rvp-soft hover:bg-white/[0.06] hover:text-rvp-text">
                    <Flag className="h-4 w-4" aria-hidden /> Signaler
                  </button>
                )}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </article>
  );
}
