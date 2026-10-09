/**
 * URL d'image affichable, ou `""` : écarte la chaîne « null », « undefined » et
 * tout ce qui n'est pas une adresse http(s). `next/image` refuse une valeur hors
 * format : la page plantait au lieu d'afficher son fond de repli. Même piège
 * que les URL audio de PROTECTED_ZONES. Repris de la branche
 * `claude/couverture-boutique-source-unique` (supprimée le 2026-10-09).
 */
export function usableImageUrl(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s || s === "null" || s === "undefined") return "";
  return /^https?:\/\//i.test(s) ? s : "";
}
