/**
 * « aux Comores », « à Djibouti », « en France » : la préposition dépend du pays.
 * `à ${country.name}` donnait « à Comores », « à France », « à Sénégal »
 * dans les titres, descriptions et bandeaux (relevé en ligne le 2026-10-09).
 */
const IN_MARKET: Record<string, string> = {
  KM: "aux Comores",
  DJ: "à Djibouti",
  FR: "en France",
  RE: "à La Réunion",
  YT: "à Mayotte",
  MG: "à Madagascar",
  SN: "au Sénégal",
  CI: "en Côte d'Ivoire",
  ML: "au Mali",
  BF: "au Burkina Faso",
  CM: "au Cameroun",
  KE: "au Kenya",
  ET: "en Éthiopie",
  TZ: "en Tanzanie",
  MR: "en Mauritanie",
  SO: "en Somalie",
};

export function inMarket(country: { id: string; name: string }): string {
  return IN_MARKET[country.id] ?? `à ${country.name}`;
}

/** « les Comores », « la Côte d'Ivoire », « Djibouti » : le pays avec son article. */
const THE_MARKET: Record<string, string> = {
  KM: "les Comores",
  DJ: "Djibouti",
  FR: "la France",
  RE: "La Réunion",
  YT: "Mayotte",
  MG: "Madagascar",
  SN: "le Sénégal",
  CI: "la Côte d'Ivoire",
  ML: "le Mali",
  BF: "le Burkina Faso",
  CM: "le Cameroun",
  KE: "le Kenya",
  ET: "l'Éthiopie",
  TZ: "la Tanzanie",
  MR: "la Mauritanie",
  SO: "la Somalie",
};

export function theMarket(country: { id: string; name: string }): string {
  return THE_MARKET[country.id] ?? country.name;
}
