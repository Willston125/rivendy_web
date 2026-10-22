import type { ReactNode } from "react";
import { PlayShell } from "@/features/play/play-shell";

/** Toutes les pages /play partagent l'en-tête, « Ma liste » et le pied de page de Play (refonte du 2026-10-22). */
export default function PlayLayout({ children }: { children: ReactNode }) {
  return <PlayShell>{children}</PlayShell>;
}
