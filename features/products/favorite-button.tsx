"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return setFavorite(false);
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      setFavorite(Boolean(data));
    }
    load();
  }, [productId, user]);

  async function toggle() {
    if (!user) {
      window.location.href = "/auth/login";
      return;
    }
    setBusy(true);
    try {
      if (favorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        setFavorite(false);
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: user.id, product_id: productId });
        setFavorite(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (className) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={cn(className, busy && "opacity-50")}
      >
        <Heart className={cn("h-4 w-4 transition", favorite && "fill-rose-500")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 active:scale-95",
        favorite
          ? "border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-400",
        busy && "opacity-50",
      )}
    >
      <Heart className={cn("h-4 w-4 transition", favorite && "fill-rose-500")} />
    </button>
  );
}
