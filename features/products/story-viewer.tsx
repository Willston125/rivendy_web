"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { firstPhoto } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import type { Product } from "@/types/rivendy";

/** Story groupée par vendeur — chaque produit = une barre de progression. */
export interface SellerStory {
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
  products: Product[];
}

const STORY_DURATION = 5000; // 5s par produit (identique à l'app Flutter)

interface StoryViewerProps {
  stories: SellerStory[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Visionneuse de stories plein écran — réplique web de `story_overlay.dart`.
 * Barres de progression, autoplay 5s, navigation tap/clavier, like, commentaires, partage.
 */
export function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [sellerIndex, setSellerIndex] = useState(initialIndex);
  const [productIndex, setProductIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const seller = stories[sellerIndex];
  const product: Product | undefined = seller?.products[productIndex];

  useEffect(() => setMounted(true), []);

  /* ── Navigation ─────────────────────────────────────────────── */
  const goNext = useCallback(() => {
    setProgress(0);
    const s = stories[sellerIndex];
    if (s && productIndex < s.products.length - 1) {
      setProductIndex((i) => i + 1);
    } else if (sellerIndex < stories.length - 1) {
      setSellerIndex((i) => i + 1);
      setProductIndex(0);
    } else {
      onClose();
    }
  }, [stories, sellerIndex, productIndex, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (productIndex > 0) {
      setProductIndex((i) => i - 1);
    } else if (sellerIndex > 0) {
      const prev = stories[sellerIndex - 1];
      setSellerIndex((i) => i - 1);
      setProductIndex(Math.max(0, prev.products.length - 1));
    }
  }, [stories, sellerIndex, productIndex]);

  /* ── Autoplay (requestAnimationFrame, pausable) ──────────────── */
  useEffect(() => {
    if (paused || commentsOpen || !product) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now - progress * STORY_DURATION;
      const ratio = Math.min(1, (now - start) / STORY_DURATION);
      setProgress(ratio);
      if (ratio >= 1) {
        goNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, commentsOpen, sellerIndex, productIndex, product]);

  /* ── Clavier ────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (commentsOpen) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose, commentsOpen]);

  /* ── Verrouille le scroll de la page en arrière-plan ─────────── */
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!mounted || !seller || !product) return null;

  const photo = firstPhoto(product);

  const overlay = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      {/* Conteneur format portrait (story) */}
      <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl">
        {/* ── Image ──────────────────────────────────────────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt={product.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60" />

        {/* ── Zones de tap (gauche = précédent, droite = suivant) ─ */}
        <button
          type="button"
          aria-label="Story précédente"
          className="absolute inset-y-0 left-0 z-10 w-1/3"
          onClick={goPrev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />
        <button
          type="button"
          aria-label="Story suivante"
          className="absolute inset-y-0 right-0 z-10 w-2/3"
          onClick={goNext}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />

        {/* ── Barres de progression ──────────────────────────── */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
          {seller.products.map((p, i) => (
            <div
              key={p.id}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width:
                    i < productIndex
                      ? "100%"
                      : i === productIndex
                      ? `${progress * 100}%`
                      : "0%",
                  transition: i === productIndex ? "none" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* ── En-tête vendeur ────────────────────────────────── */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 pb-8 pt-7">
          <Link
            href={`/store/${seller.sellerId}`}
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#007168] text-base font-bold text-white ring-2 ring-white">
              {seller.sellerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seller.sellerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (seller.sellerName?.[0] ?? "?").toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white drop-shadow">
                {seller.sellerName || "Boutique"}
              </p>
              <div className="flex items-center gap-1.5">
                {seller.products.length > 1 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {productIndex + 1}/{seller.products.length}
                  </span>
                )}
                <span className="truncate text-[11px] text-white/85 drop-shadow">
                  {product.title}
                </span>
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="z-30 ml-auto grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Flèches desktop ────────────────────────────────── */}
        {(sellerIndex > 0 || productIndex > 0) && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Précédent"
            className="absolute left-2 top-1/2 z-30 hidden -translate-y-1/2 place-items-center rounded-full bg-black/30 p-2 text-white transition hover:bg-black/50 sm:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          aria-label="Suivant"
          className="absolute right-2 top-1/2 z-30 hidden -translate-y-1/2 place-items-center rounded-full bg-black/30 p-2 text-white transition hover:bg-black/50 sm:grid"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* ── Réactions (droite) ─────────────────────────────── */}
        <div className="absolute bottom-32 right-3 z-20 flex flex-col items-center gap-4">
          <LikeButton productId={product.id} initialCount={product.likes_count} />
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-black/30 transition hover:bg-black/45">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold drop-shadow">{product.comments_count}</span>
          </button>
          <ShareStoryButton productId={product.id} />
        </div>

        {/* ── CTA "Voir l'article" ───────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-5 pt-12">
          <Link
            href={`/products/${product.id}`}
            onClick={onClose}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#007168] text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-[#007168]/40 transition hover:bg-[#00796B]"
          >
            <ShoppingBag className="h-5 w-5" />
            Voir l&apos;article
          </Link>
        </div>

        {/* ── Panneau commentaires ───────────────────────────── */}
        {commentsOpen && (
          <CommentsPanel
            productId={product.id}
            productImage={photo}
            sellerId={seller.sellerId}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ════════════════════════════════════════════════════════════════
   Bouton Like (favori) — persistance Supabase
════════════════════════════════════════════════════════════════ */
function LikeButton({ productId, initialCount }: { productId: string; initialCount: number }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCount(initialCount ?? 0);
    let active = true;
    async function load() {
      if (!user) return setLiked(false);
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (active) setLiked(Boolean(data));
    }
    load();
    return () => {
      active = false;
    };
  }, [productId, user, initialCount]);

  async function toggle() {
    if (!user) {
      window.location.href = "/auth/login";
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
      } else {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} className="flex flex-col items-center gap-1 text-white">
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full transition",
          liked ? "bg-rose-500/25" : "bg-black/30 hover:bg-black/45",
        )}
      >
        <Heart className={cn("h-6 w-6 transition", liked && "fill-rose-500 text-rose-500")} />
      </span>
      <span className="text-xs font-semibold drop-shadow">{count}</span>
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   Bouton Partage — copie le lien produit
════════════════════════════════════════════════════════════════ */
function ShareStoryButton({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/products/${productId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "Rivendy" });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* annulé par l'utilisateur */
    }
  }

  return (
    <button type="button" onClick={share} className="flex flex-col items-center gap-1 text-white">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-black/30 transition hover:bg-black/45">
        <Send className="h-6 w-6" />
      </span>
      <span className="text-xs font-semibold drop-shadow">{copied ? "Copié" : "Partager"}</span>
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   Panneau commentaires (sheet bas)
════════════════════════════════════════════════════════════════ */
interface Comment {
  id: string;
  user_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

function CommentsPanel({
  productId,
  productImage,
  sellerId,
  onClose,
}: {
  productId: string;
  productImage: string;
  sellerId: string;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("product_comments")
        .select("id, user_id, author_name, text, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (active) {
        setComments((data as Comment[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [productId]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (!user) {
      window.location.href = "/auth/login";
      return;
    }
    setSending(true);
    const authorName =
      profile?.full_name || profile?.store_name || user.email?.split("@")[0] || "Anonyme";
    const avatarUrl = profile?.avatar_url || null;
    const { data, error } = await supabase
      .from("product_comments")
      .insert({
        product_id: productId,
        user_id: user.id,
        author_name: authorName,
        avatar_url: avatarUrl,
        text: trimmed,
        likes_count: 0,
        is_flagged: false,
      })
      .select("id, user_id, author_name, text, created_at")
      .single();
    setSending(false);
    if (!error && data) {
      setComments((prev) => [data as Comment, ...prev]);
      setText("");
      // Incrémente le compteur produit (best-effort)
      const { data: prod } = await supabase
        .from("products")
        .select("comments_count")
        .eq("id", productId)
        .maybeSingle();
      await supabase
        .from("products")
        .update({ comments_count: (prod?.comments_count ?? 0) + 1 })
        .eq("id", productId);
      if (sellerId && sellerId !== user.id) {
        await supabase.from("app_notifications").insert({
          user_id: sellerId,
          type: "new_comment",
          title: "💬 Nouveau commentaire",
          body: `${authorName} a commenté votre article.`,
          product_id: productId,
          product_image: productImage,
          is_read: false,
        });
      }
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative flex max-h-[75%] flex-col rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">
            💬 Commentaires{comments.length > 0 && ` · ${comments.length}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les commentaires"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Aucun commentaire — soyez le premier !
            </p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007168]/15 text-sm font-bold text-[#007168]">
                    {(c.author_name?.[0] ?? "?").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{c.author_name}</p>
                    <p className="text-sm text-slate-700">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Saisie */}
        <div className="flex items-center gap-2 border-t border-slate-100 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ajouter un commentaire…"
            className="h-11 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#007168]/30"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || !text.trim()}
            aria-label="Envoyer"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#007168] text-white transition hover:bg-[#00796B] disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
