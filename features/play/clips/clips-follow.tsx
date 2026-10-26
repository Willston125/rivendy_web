"use client";

import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";
import { motion } from "../play-theme";
import { useClips } from "./clips-store";

/**
 * « Suivre » un artiste : on suit la PERSONNE (son compte), comme dans l'app
 * et la Musique (`person_follow`) — ses clips arrivent dans Abonnements. Sans
 * compte, la connexion s'ouvre et l'abonnement se fait au retour.
 */
export function FollowButton({ userId, name, size = "md", className }: {
  userId: string | null | undefined; name: string; size?: "sm" | "md"; className?: string;
}) {
  const { user } = useAuth();
  const { follows } = useClips();
  if (!userId || user?.id === userId) return null;
  const on = follows.ids?.has(userId) ?? false;
  const busy = follows.busy(userId);
  return (
    <button type="button" aria-pressed={on} disabled={busy} onClick={() => void follows.toggle(userId, name)}
      aria-label={on ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      className={cn("inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold", motion,
        size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-[14px]",
        on ? "border border-rvp-edge bg-rvp-raised text-rvp-soft hover:text-rvp-text"
          : "bg-rvp-accent text-rvp-on-accent hover:bg-rvp-accent-hover active:bg-rvp-accent-pressed",
        className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <UserCheck className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
      {on ? "Abonné" : "Suivre"}
    </button>
  );
}
