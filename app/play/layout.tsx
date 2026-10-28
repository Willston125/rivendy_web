import type { ReactNode } from "react";
import { PlayShell } from "@/features/play/play-shell";
import { appFontVariables } from "@/lib/app-fonts";

/** Toutes les pages /play partagent la coque de Play : menu, barre du haut, « Ma liste », pied de page. */
export default function PlayLayout({ children }: { children: ReactNode }) {
  return <PlayShell fontClassName={appFontVariables}>{children}</PlayShell>;
}
