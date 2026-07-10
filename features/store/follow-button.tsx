"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";

interface FollowButtonProps {
  sellerId: string;
  onFollowChanged?: (isFollowing: boolean) => void;
}

export function FollowButton({ sellerId, onFollowChanged }: FollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Vérifier si l'utilisateur suit déjà ce vendeur
  const checkFollowStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("store_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("seller_id", sellerId)
        .maybeSingle();

      setFollowing(!!data);
    } catch (_) {}
    setLoading(false);
  }, [user, sellerId]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  // Action de suivi/désabonnement
  const handleToggleFollow = async () => {
    if (!user) {
      // Rediriger vers la connexion plutôt qu'alert()
      router.push(`/auth/login?redirect=/store/${sellerId}`);
      return;
    }
    // Le bouton est masqué pour le propriétaire (voir ci-dessous), mais garde-fou
    if (user.id === sellerId) return;

    setToggling(true);

    try {
      if (following) {
        // Désabonnement
        await supabase
          .from("store_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("seller_id", sellerId);

        setFollowing(false);
        if (onFollowChanged) onFollowChanged(false);
      } else {
        // Abonnement
        await supabase
          .from("store_follows")
          .upsert({
            follower_id: user.id,
            seller_id: sellerId,
          }, {
            onConflict: "follower_id,seller_id"
          });

        setFollowing(true);
        if (onFollowChanged) onFollowChanged(true);
      }
    } catch (_) {
      // Échec silencieux — pas d'alert() bloquant
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-400"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  // Ne pas afficher de bouton d'abonnement si l'utilisateur est le vendeur lui-même
  if (user && user.id === sellerId) {
    return null;
  }

  return (
    <button
      onClick={handleToggleFollow}
      disabled={toggling}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold transition-all active:scale-95",
        following
          ? "border-[#009688] bg-[#E0F2F1] text-[#009688] hover:bg-[#009688]/15"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {toggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <Heart className="h-4 w-4 fill-[#009688]" />
          Suivi
        </>
      ) : (
        <>
          <Heart className="h-4 w-4" />
          Suivre
        </>
      )}
    </button>
  );
}
