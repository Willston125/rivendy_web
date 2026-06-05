"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";

interface ProductRatingInputProps {
  productId: string;
  onRatingChanged?: (newRating: number) => void;
}

export function ProductRatingInput({ productId, onRatingChanged }: ProductRatingInputProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Charger la note actuelle de l'utilisateur
  const fetchUserRating = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("product_ratings")
        .select("rating")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (data) {
        setRating(data.rating);
      }
    } catch (_) {}
  }, [user, productId]);

  useEffect(() => {
    fetchUserRating();
  }, [fetchUserRating]);

  // Enregistrer le vote
  const handleRate = async (value: number) => {
    if (!user) {
      setErrorMsg("Veuillez vous connecter pour noter ce produit.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccess(false);

    try {
      const { error } = await supabase.from("product_ratings").upsert(
        {
          user_id: user.id,
          product_id: productId,
          rating: value,
        },
        { onConflict: "user_id,product_id" }
      );

      if (error) throw error;

      setRating(value);
      setSuccess(true);
      if (onRatingChanged) onRatingChanged(value);

      // Masquer le badge succès après 3 secondes
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setErrorMsg("Impossible d'enregistrer votre note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Votre note pour cet article</h4>
          <p className="mt-0.5 text-xs text-slate-500">Aidez les autres acheteurs en partageant votre avis.</p>
        </div>

        {/* Etoiles interactives */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const stars = i + 1;
              const active = hoverRating ? stars <= hoverRating : stars <= rating;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleRate(stars)}
                  onMouseEnter={() => setHoverRating(stars)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={submitting}
                  className="transition-transform active:scale-90 disabled:opacity-50"
                  aria-label={`Noter ${stars} étoiles`}
                >
                  <Star
                    className={cn(
                      "h-5 w-5 cursor-pointer transition-colors",
                      active ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Retours utilisateur */}
      {success && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#009688]">
          <CheckCircle className="h-3 w-3 shrink-0" />
          Note enregistrée avec succès !
        </p>
      )}
      {errorMsg && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-600">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}
