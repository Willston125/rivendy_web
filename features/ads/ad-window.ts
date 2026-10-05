import type { Advertisement } from "@/types/rivendy";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fenêtre de diffusion d'une publicité — miroir EXACT de l'app
 * (`AdvertisementService.getActiveBanners`, advertisement_service.dart) :
 *  - début STRICT : rien avant `starts_at` ;
 *  - fin INCLUSIVE : le dashboard stocke une date à minuit, une fin
 *    « aujourd'hui » reste valable jusqu'à la fin du jour (+24 h).
 *
 * Jusqu'au 2026-10-04 le site accordait aussi 24 h de marge AVANT le début :
 * une campagne programmée pour demain s'affichait dès aujourd'hui sur le web,
 * et pas dans l'app.
 */
export function isAdLive(
  ad: Pick<Advertisement, "starts_at" | "ends_at">,
  now = Date.now(),
): boolean {
  if (ad.starts_at && Date.parse(ad.starts_at) > now) return false;
  if (ad.ends_at && Date.parse(ad.ends_at) + DAY_MS <= now) return false;
  return true;
}
