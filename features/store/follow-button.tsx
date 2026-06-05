"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";

interface FollowButtonProps {
  sellerId: string;
  onFollowChanged?: (isFollowing: boolean) => void;
}

export function FollowButton({ sellerId, onFollowChanged }: FollowButtonProps) {
  const { user } = useAuth();
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
      alert("Veuillez vous connecter pour vous abonner à cette boutique.");
      return;
    }
    if (user.id === sellerId) {
      alert("Vous ne pouvez pas vous abonner à votre propre boutique.");
      return;
    }

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
      alert("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-xs font-bold text-slate-400"
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
        "inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-black transition-all active:scale-95",
        following
          ? "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
          : "bg-[#009688] text-white shadow-sm shadow-[#009688]/20 hover:bg-[#00796B]"
      )}
    >
      {toggling ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : following ? (
        <>
          <UserCheck className="h-3.5 w-3.5" />
          Abonné
        </>
      ) : (
        <>
          <UserPlus className="h-3.5 w-3.5" />
          S&apos;abonner
        </>
      )}
    </button>
  );
}
