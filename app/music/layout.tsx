import type { ReactNode } from "react";
import { MusicShell } from "@/features/music/music-shell";

/** Toutes les pages /music partagent la navigation de la Musique (refonte du 2026-10-22). */
export default function MusicLayout({ children }: { children: ReactNode }) {
  return <MusicShell>{children}</MusicShell>;
}
