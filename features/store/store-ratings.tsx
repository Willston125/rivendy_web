"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Star, MessageSquare, AlertTriangle, CheckCircle, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { ContentFilter } from "@/lib/utils/content-filter";
import { cn } from "@/lib/utils/cn";

export type StoreReview = {
  rating: number;
  comment: string;
  authorName: string;
  avatarUrl: string | null;
  createdAt: string;
};

interface StoreRatingsProps {
  sellerId: string;
  onRatingSubmitted?: () => void;
}

export function StoreRatings({ sellerId, onRatingSubmitted }: StoreRatingsProps) {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire de vote
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Charger les avis
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_ratings")
        .select(`
          rating,
          comment,
          created_at,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        const formatted = (data as unknown as Array<{
          rating: number;
          comment: string | null;
          created_at: string;
          profiles: {
            full_name: string | null;
            avatar_url: string | null;
          } | null;
        }>).map((row) => {
          const prof = row.profiles;
          return {
            rating: row.rating,
            comment: row.comment ?? "",
            authorName: prof?.full_name || "Acheteur Rivendy",
            avatarUrl: prof?.avatar_url || null,
            createdAt: row.created_at,
          };
        });
        setReviews(formatted);
      }
    } catch (_) {}
    setLoading(false);
  }, [sellerId]);

  // Charger le vote de l'utilisateur connecté
  const fetchUserVote = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("store_ratings")
        .select("rating, comment")
        .eq("user_id", user.id)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (data) {
        setUserRating(data.rating);
        setComment(data.comment ?? "");
      }
    } catch (_) {}
  }, [user, sellerId]);

  useEffect(() => {
    fetchReviews();
    fetchUserVote();
  }, [fetchReviews, fetchUserVote]);

  // Statistiques de distribution
  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
    let sum = 0;
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      sum += r.rating;
      const index = Math.min(4, Math.max(0, r.rating - 1));
      dist[index]++;
    });
    return {
      avg: Number((sum / reviews.length).toFixed(1)),
      count: reviews.length,
      distribution: dist.reverse(), // De 5 étoiles à 1 étoile
    };
  }, [reviews]);

  // Soumettre l'évaluation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (userRating < 1 || userRating > 5) {
      setErrorMsg("Veuillez sélectionner une note entre 1 et 5 étoiles.");
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > 0 && !ContentFilter.isClean(trimmedComment)) {
      setErrorMsg(ContentFilter.errorMessage);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const { error } = await supabase.from("store_ratings").upsert(
        {
          user_id: user.id,
          seller_id: sellerId,
          rating: userRating,
          comment: trimmedComment || null,
        },
        { onConflict: "user_id,seller_id" }
      );

      if (error) throw error;

      setSuccessMsg("Votre avis a été enregistré avec succès !");
      fetchReviews();
      if (onRatingSubmitted) onRatingSubmitted();
    } catch (err) {
      setErrorMsg("Une erreur s'est produite lors de l'enregistrement de votre avis.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      {/* ── COLONNE GAUCHE : STATISTIQUES ───────────────────────────── */}
      <section className="space-y-4 rounded-3xl bg-slate-50 p-5 text-center md:text-left">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Avis global</h3>
          <div className="mt-2 flex items-baseline justify-center gap-2 md:justify-start">
            <span className="text-4xl font-black text-slate-900">{stats.avg || "—"}</span>
            <span className="text-sm font-bold text-slate-400">/ 5</span>
          </div>
          {/* Étoiles */}
          <div className="mt-1.5 flex justify-center gap-0.5 md:justify-start">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-4 w-4",
                  i < Math.round(stats.avg) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {stats.count} avis enregistré{stats.count > 1 ? "s" : ""}
          </p>
        </div>

        {/* Distribution des étoiles */}
        <div className="space-y-1.5 border-t border-slate-200/60 pt-4">
          {stats.distribution.map((cnt, idx) => {
            const stars = 5 - idx;
            const pct = stats.count > 0 ? (cnt / stats.count) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-3 text-right">{stars}</span>
                <Star className="h-3 w-3 fill-slate-400 text-slate-400 shrink-0" />
                <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-slate-400">{cnt}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── COLONNE DROITE : FORMULAIRE & AVIS ───────────────────────── */}
      <section className="space-y-6">
        {/* Formulaire de vote (si connecté et pas le vendeur lui-même) */}
        {user && user.id !== sellerId && (
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-black text-slate-900">Votre évaluation de la boutique</h4>
            <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
              {/* Sélecteur étoiles */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Note :</span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const stars = i + 1;
                    const active = hoverRating ? stars <= hoverRating : stars <= userRating;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setUserRating(stars)}
                        onMouseEnter={() => setHoverRating(stars)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform active:scale-95"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 cursor-pointer transition-colors",
                            active ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Commentaire */}
              <div className="relative">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Écrivez un commentaire libre sur votre expérience d'achat avec ce vendeur (facultatif)..."
                  className="min-h-[70px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,150,136,0.1)] resize-none"
                />
              </div>

              {/* Soumettre */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  {errorMsg && (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {errorMsg}
                    </p>
                  )}
                  {successMsg && (
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#009688]">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      {successMsg}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting || userRating === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#009688] px-6 text-xs font-black text-white shadow-sm shadow-[#009688]/20 transition hover:bg-[#00796B] disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enregistrer mon avis
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des avis */}
        <div className="space-y-4">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#009688]" />
            Avis clients récents ({reviews.length})
          </h4>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                  <div className="h-3 w-3/4 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-slate-400">
              <p className="text-xs font-medium">Aucun avis rédigé pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-slate-900">{rev.authorName}</p>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>

                  {/* Note étoiles */}
                  <div className="flex gap-px">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3 w-3",
                          i < rev.rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"
                        )}
                      />
                    ))}
                  </div>

                  {rev.comment && (
                    <p className="text-xs leading-relaxed text-slate-600 break-words">{rev.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


