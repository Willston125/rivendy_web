/**
 * Heure locale d'un marché, pour les calculs faits côté SERVEUR.
 *
 * Vercel tourne en UTC : `new Date().getHours()` y donne l'heure UTC, soit
 * 3 h de retard sur Moroni ou Djibouti. L'app, elle, lit l'heure de
 * l'appareil (donc l'heure locale de l'acheteur). Sans cette correction, un
 * restaurant « 08:00 - 22:00 » apparaissait fermé sur le site jusqu'à 11 h,
 * heure des Comores.
 *
 * `countries` n'a pas de colonne de fuseau : la table ci-dessous couvre les
 * 16 marchés de `PRICE_TIERS` (lib/utils/commission.ts). Un marché absent
 * retombe sur l'heure du serveur, comme avant.
 */
const MARKET_TIME_ZONES: Record<string, string> = {
  KM: "Indian/Comoro",
  DJ: "Africa/Djibouti",
  SN: "Africa/Dakar",
  CI: "Africa/Abidjan",
  ML: "Africa/Bamako",
  BF: "Africa/Ouagadougou",
  CM: "Africa/Douala",
  FR: "Europe/Paris",
  RE: "Indian/Reunion",
  YT: "Indian/Mayotte",
  MG: "Indian/Antananarivo",
  KE: "Africa/Nairobi",
  ET: "Africa/Addis_Ababa",
  TZ: "Africa/Dar_es_Salaam",
  MR: "Africa/Nouakchott",
  SO: "Africa/Mogadishu",
};

/**
 * Date dont `getHours()` / `getMinutes()` renvoient l'heure locale du marché,
 * quel que soit le fuseau du processus. À n'utiliser que pour lire l'heure
 * murale (pas pour un horodatage).
 */
export function marketNow(countryId?: string | null, now: Date = new Date()): Date {
  const timeZone = countryId ? MARKET_TIME_ZONES[countryId.toUpperCase()] : undefined;
  if (!timeZone) return now;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  } catch {
    return now;
  }
}
