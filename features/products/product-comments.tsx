"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageCircle, Heart, Trash2, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { ContentFilter } from "@/lib/utils/content-filter";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type ProductComment = {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string;
  avatar_url: string | null;
  text: string;
  likes_count: number;
  is_flagged: boolean;
  created_at: string;
};

interface ProductCommentsProps {
  productId: string;
  sellerId: string;
  productTitle: string;
  productImage: string;
}

export function ProductComments({
  productId,
  sellerId,
  productTitle,
  productImage,
}: ProductCommentsProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stocke localement les commentaires likés par l'utilisateur dans cette session
  const [likedCommentIds, setLikedCommentIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`liked_comments_${productId}`);
      if (stored) {
        try {
          setLikedCommentIds(JSON.parse(stored));
        } catch (_) {}
      }
    }
  }, [productId]);

  const saveLikes = (ids: string[]) => {
    setLikedCommentIds(ids);
    if (typeof window !== "undefined") {
      localStorage.setItem(`liked_comments_${productId}`, JSON.stringify(ids));
    }
  };

  /* ── Formattage de la date à la "timeAgo" ─────────────────────── */
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diff / (60 * 1000));
    const diffHours = Math.floor(diff / (60 * 60 * 1000));
    const diffDays = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString("fr-FR");
  };

  /* ── Charger les commentaires ────────────────────────────────── */
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_comments")
      .select("*")
      .eq("product_id", productId)
      .eq("is_flagged", false)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setComments(data as ProductComment[]);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  /* ── Soumettre un commentaire ────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setErrorMsg("Le commentaire doit faire au moins 2 caractères.");
      return;
    }
    if (trimmed.length > 500) {
      setErrorMsg("Le commentaire ne peut pas dépasser 500 caractères.");
      return;
    }

    // Filtrage de contenu
    if (!ContentFilter.isClean(trimmed)) {
      setErrorMsg(ContentFilter.errorMessage);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const displayName = profile?.full_name || profile?.store_name || user.email?.split("@")[0] || "Anonyme";
      const avatarUrl = profile?.avatar_url || "";

      const { data, error } = await supabase
        .from("product_comments")
        .insert({
          product_id: productId,
          user_id: user.id,
          author_name: displayName,
          avatar_url: avatarUrl || null,
          text: trimmed,
          likes_count: 0,
          is_flagged: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setComments((prev) => [data as ProductComment, ...prev]);
        setText("");

        // Incrémenter le compteur de commentaires du produit
        const { data: prod } = await supabase
          .from("products")
          .select("comments_count")
          .eq("id", productId)
          .maybeSingle();
        const currentCount = prod?.comments_count ?? 0;
        await supabase
          .from("products")
          .update({ comments_count: currentCount + 1 })
          .eq("id", productId);

        // Envoyer une notification au vendeur
        if (sellerId !== user.id) {
          const shortTitle = productTitle.length > 40 ? `${productTitle.substring(0, 40)}…` : productTitle;
          await supabase.from("app_notifications").insert({
            user_id: sellerId,
            type: "new_comment",
            title: "💬 Nouveau commentaire",
            body: `${displayName} a commenté votre article "${shortTitle}".`,
            product_id: productId,
            product_image: productImage,
            is_read: false,
          });
        }
      }
    } catch (err) {
      setErrorMsg("Erreur lors de la publication du commentaire. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Liker un commentaire ────────────────────────────────────── */
  const handleLike = async (comment: ProductComment) => {
    const isLiked = likedCommentIds.includes(comment.id);
    const newLikesCount = isLiked
      ? Math.max(0, comment.likes_count - 1)
      : comment.likes_count + 1;

    // Mise à jour de l'état local immédiatement
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, likes_count: newLikesCount } : c))
    );

    // Sauvegarde de l'état de like local
    if (isLiked) {
      saveLikes(likedCommentIds.filter((id) => id !== comment.id));
    } else {
      saveLikes([...likedCommentIds, comment.id]);
    }

    // Mise à jour en base de données
    await supabase
      .from("product_comments")
      .update({ likes_count: newLikesCount })
      .eq("id", comment.id);
  };

  /* ── Signaler un commentaire ─────────────────────────────────── */
  const handleFlag = async (commentId: string) => {
    if (!confirm("Voulez-vous vraiment signaler ce commentaire pour contenu inapproprié ?")) {
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));

    await supabase
      .from("product_comments")
      .update({ is_flagged: true })
      .eq("id", commentId);
  };

  /* ── Supprimer un commentaire ────────────────────────────────── */
  const handleDelete = async (comment: ProductComment) => {
    if (!confirm("Voulez-vous supprimer votre commentaire ?")) {
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== comment.id));

    try {
      await supabase.from("product_comments").delete().eq("id", comment.id);

      // Décrémenter le compteur de commentaires du produit
      const { data: prod } = await supabase
        .from("products")
        .select("comments_count")
        .eq("id", productId)
        .maybeSingle();
      const currentCount = prod?.comments_count ?? 0;
      if (currentCount > 0) {
        await supabase
          .from("products")
          .update({ comments_count: currentCount - 1 })
          .eq("id", productId);
      }
    } catch (_) {}
  };

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
        <MessageCircle className="h-5 w-5 text-[#009688]" />
        <h3 className="text-lg font-black text-slate-900">
          Commentaires
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
            {comments.length}
          </span>
        </h3>
      </div>

      {/* Formulaire d'ajout */}
      {user ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="relative flex gap-3">
            {/* Avatar utilisateur */}
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#E0F2F1]">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#009688]">
                  {(profile?.full_name || profile?.store_name || user.email || "U")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>

            {/* Input de saisie */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Écrivez un commentaire public..."
                  disabled={submitting}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,150,136,0.1)]"
                />
                <button
                  type="submit"
                  disabled={submitting || text.trim().length < 2}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#009688] text-white transition hover:bg-[#00796B] disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {errorMsg && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-500">
            Vous devez être connecté pour écrire un commentaire.
          </p>
        </div>
      )}

      {/* Liste des commentaires */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="space-y-4 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                  <div className="h-3 w-3/4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <p className="text-xs font-medium">Aucun commentaire pour le moment. Soyez le premier à commenter !</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {comments.map((comment) => {
              const isAuthor = user?.id === comment.user_id;
              const isLiked = likedCommentIds.includes(comment.id);

              return (
                <div key={comment.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  {/* Avatar auteur */}
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {comment.avatar_url ? (
                      <Image
                        src={comment.avatar_url}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400 bg-slate-100">
                        {comment.author_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {comment.author_name}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {formatTimeAgo(comment.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm leading-relaxed text-slate-600 break-words">
                      {comment.text}
                    </p>

                    {/* Actions sur le commentaire */}
                    <div className="mt-2.5 flex items-center gap-4">
                      {/* Bouton Like */}
                      <button
                        onClick={() => handleLike(comment)}
                        className={cn(
                          "flex items-center gap-1 text-[11px] font-bold transition-colors",
                          isLiked ? "text-red-500" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-red-500")} />
                        {comment.likes_count > 0 && comment.likes_count}
                      </button>

                      {/* Bouton Signaler (uniquement si pas l'auteur) */}
                      {!isAuthor && (
                        <button
                          onClick={() => handleFlag(comment.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Signaler
                        </button>
                      )}

                      {/* Bouton Supprimer (si auteur) */}
                      {isAuthor && (
                        <button
                          onClick={() => handleDelete(comment)}
                          className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
