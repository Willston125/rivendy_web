/**
 * 📆 DATES DE SÉJOUR — toujours des DATES LOCALES, jamais des instants.
 *
 * Une date de séjour s'écrit `AAAA-MM-JJ` (le format du `DATE` Postgres) et
 * se manipule en heure LOCALE. Ne JAMAIS passer par `toISOString()` : elle
 * convertit en UTC et décale d'un jour toute date choisie le soir à l'est
 * de Greenwich (Comores, Djibouti = UTC+3) ou le matin à l'ouest.
 *
 * Miroir de `HotelSearchQuery.dateOnly` / `toSqlDate` côté Flutter.
 */

const SQL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Mois en toutes lettres — mêmes mots que `HotelDateLabels.months` (app). */
export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

/** Vrai si la chaîne est une date `AAAA-MM-JJ` qui existe réellement. */
export function isSqlDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = SQL_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Refuse le 31 février, que `new Date` « corrigerait » en 3 mars.
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** `AAAA-MM-JJ` → Date à minuit LOCAL. `null` si la chaîne est invalide. */
export function parseSqlDate(value: string | null | undefined): Date | null {
  if (!isSqlDate(value)) return null;
  const m = SQL_DATE.exec(value)!;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date → `AAAA-MM-JJ` lu en heure LOCALE (jamais via toISOString). */
export function toSqlDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Normalise un instant à minuit local. */
export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Aujourd'hui, en date locale `AAAA-MM-JJ`. À n'appeler que côté navigateur. */
export function todaySql(): string {
  return toSqlDate(new Date());
}

/** Ajoute des jours à une date `AAAA-MM-JJ` (arithmétique calendaire locale). */
export function addDaysSql(value: string, days: number): string {
  const d = parseSqlDate(value);
  if (!d) return value;
  return toSqlDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Ajoute des mois (borne du calendrier : 12 mois, comme `HotelDatePicker`). */
export function addMonthsSql(value: string, months: number): string {
  const d = parseSqlDate(value);
  if (!d) return value;
  return toSqlDate(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
}

/** Compare deux dates `AAAA-MM-JJ` (l'ordre lexical est l'ordre chronologique). */
export function compareSql(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** « 28 août » — sans l'année, qui alourdit sans informer. */
export function dayMonthLabel(value: string): string {
  const d = parseSqlDate(value);
  if (!d) return value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « 28 août 2026 » — pour les écrans de réservation ferme. */
export function fullDateLabel(value: string): string {
  const d = parseSqlDate(value);
  if (!d) return value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 28–30 août » quand le mois est le même, « 30 août – 2 septembre » sinon. */
export function rangeLabel(from: string | null | undefined, to: string | null | undefined): string {
  const a = parseSqlDate(from);
  const b = parseSqlDate(to);
  if (!a || !b) return "Choisir les dates";
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}`;
  }
  return `${dayMonthLabel(from!)} – ${dayMonthLabel(to!)}`;
}

/** « 2 nuits », « 1 nuit ». */
export function nightsLabel(count: number): string {
  return `${count} nuit${count > 1 ? "s" : ""}`;
}

/** « 3 voyageurs · 1 chambre ». */
export function guestsLabel(adults: number, children: number, rooms: number): string {
  const total = adults + children;
  return `${total} voyageur${total > 1 ? "s" : ""} · ${rooms} chambre${rooms > 1 ? "s" : ""}`;
}

/** Postgres renvoie un `TIME` sous la forme `14:00:00`. On garde `14:00`. */
export function hhmm(raw: unknown, fallback: string): string {
  const s = raw == null ? "" : String(raw);
  return s.length >= 5 ? s.slice(0, 5) : fallback;
}
