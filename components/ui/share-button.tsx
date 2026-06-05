"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
  variant?: "icon" | "button";
  label?: string;
}

export function ShareButton({
  title,
  text,
  url,
  className,
  variant = "icon",
  label = "Partager",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    
    // Essayer l'API Web Share d'abord (mobile natif)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "Rivendy",
          text: text || "Regarde ça sur Rivendy !",
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to copy si annulé ou échec, sauf si c'est une annulation volontaire
        if ((err as Error).name !== "AbortError") {
          fallbackCopy(shareUrl);
        }
      }
    } else {
      fallbackCopy(shareUrl);
    }
  };

  const fallbackCopy = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleShare}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition",
          copied
            ? "border-green-200 bg-green-50 text-green-600"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          className
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Lien copié !" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Partager"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200",
        copied && "bg-green-100 text-green-600 hover:bg-green-200",
        className
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
    </button>
  );
}
