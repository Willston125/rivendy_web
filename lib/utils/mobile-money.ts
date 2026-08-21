/**
 * 📱 DONNÉES MOBILE MONEY — miroir EXACT de
 * rivendy_app/lib/core/utils/mobile_money_data.dart (kMobileMoneyByCountry).
 * Toute modification (numéro, activation, nouvelle méthode) doit être faite
 * dans les DEUX fichiers ensemble.
 *
 * ⚠️ Règle absolue : NE JAMAIS hardcoder un numéro de pays dans une page.
 *    Toujours passer par getMobileMoneyForCountry(countryCode).
 *
 * enabled: true  → numéro affiché, paiement possible maintenant
 * enabled: false → grisé « Bientôt disponible »
 */

export interface MobileMoneyMethod {
  id: string;
  name: string;
  /** Absent tant que le compte n'est pas configuré. */
  number?: string;
  color: string;
  enabled: boolean;
}

/** Espèces — toujours disponible dans tous les pays, toujours en dernier. */
export const CASH_METHOD: MobileMoneyMethod = {
  id: "cash",
  name: "Espèces (cash)",
  color: "#64748B",
  enabled: true,
};

const MOBILE_MONEY_BY_COUNTRY: Record<string, MobileMoneyMethod[]> = {
  // ── Djibouti ──
  DJ: [
    { id: "waafi_dj", name: "Waafi", number: "77556344", color: "#388E3C", enabled: true },
    { id: "dmoney_dj", name: "D-Money", color: "#1976D2", enabled: false },
    { id: "cacpay_dj", name: "CAC Pay", color: "#E64A19", enabled: false },
  ],
  // ── Somalie ──
  SO: [
    { id: "evc_so", name: "EVC Plus (Hormuud)", color: "#E64A19", enabled: false },
    { id: "sahal_so", name: "Sahal", color: "#1976D2", enabled: false },
  ],
  // ── Kenya ──
  KE: [
    { id: "mpesa_ke", name: "M-Pesa", color: "#388E3C", enabled: false },
    { id: "airtel_ke", name: "Airtel Money", color: "#E64A19", enabled: false },
  ],
  // ── Tanzanie ──
  TZ: [
    { id: "mpesa_tz", name: "M-Pesa", color: "#388E3C", enabled: false },
    { id: "airtel_tz", name: "Airtel Money", color: "#E64A19", enabled: false },
    { id: "tigopesa_tz", name: "Tigo Pesa", color: "#1976D2", enabled: false },
  ],
  // ── Éthiopie ──
  ET: [{ id: "telebirr_et", name: "Telebirr", color: "#388E3C", enabled: false }],
  // ── Sénégal ──
  SN: [
    { id: "wave_sn", name: "Wave", color: "#1976D2", enabled: false },
    { id: "orange_sn", name: "Orange Money", color: "#FF6D00", enabled: false },
    { id: "free_sn", name: "Free Money", color: "#388E3C", enabled: false },
  ],
  // ── Côte d'Ivoire ──
  CI: [
    { id: "orange_ci", name: "Orange Money", color: "#FF6D00", enabled: false },
    { id: "mtn_ci", name: "MTN MoMo", color: "#FFB800", enabled: false },
    { id: "moov_ci", name: "Moov Money", color: "#1976D2", enabled: false },
  ],
  // ── Cameroun ──
  CM: [
    { id: "mtn_cm", name: "MTN MoMo", color: "#FFB800", enabled: false },
    { id: "orange_cm", name: "Orange Money", color: "#FF6D00", enabled: false },
  ],
  // ── Burkina Faso ──
  BF: [
    { id: "orange_bf", name: "Orange Money", color: "#FF6D00", enabled: false },
    { id: "moov_bf", name: "Moov Money", color: "#1976D2", enabled: false },
  ],
  // ── Mali ──
  ML: [
    { id: "orange_ml", name: "Orange Money", color: "#FF6D00", enabled: false },
    { id: "moov_ml", name: "Moov Money", color: "#1976D2", enabled: false },
  ],
  // ── Mauritanie ──
  MR: [
    { id: "bankily_mr", name: "Bankily", color: "#1976D2", enabled: false },
    { id: "masrivi_mr", name: "Masrivi", color: "#388E3C", enabled: false },
  ],
  // ── Madagascar ──
  MG: [
    { id: "mvola_mg", name: "MVola", color: "#E64A19", enabled: false },
    { id: "airtel_mg", name: "Airtel Money", color: "#E64A19", enabled: false },
  ],
  // ── Comores ──
  KM: [{ id: "mcomores_km", name: "M-Comores", color: "#388E3C", enabled: false }],
  // ── France ──
  FR: [
    { id: "card_fr", name: "Carte bancaire", color: "#1976D2", enabled: false },
    { id: "paypal_fr", name: "PayPal", color: "#003087", enabled: false },
  ],
  // ── Mayotte ──
  YT: [{ id: "card_yt", name: "Carte bancaire", color: "#1976D2", enabled: false }],
  // ── La Réunion ──
  RE: [{ id: "card_re", name: "Carte bancaire", color: "#1976D2", enabled: false }],
};

/**
 * Liste complète pour un pays.
 * Ordre : méthodes activées → méthodes désactivées → espèces (toujours en dernier).
 */
export function getMobileMoneyForCountry(countryCode: string): MobileMoneyMethod[] {
  const list = MOBILE_MONEY_BY_COUNTRY[countryCode] ?? [];
  return [
    ...list.filter((m) => m.enabled),
    ...list.filter((m) => !m.enabled),
    CASH_METHOD,
  ];
}
