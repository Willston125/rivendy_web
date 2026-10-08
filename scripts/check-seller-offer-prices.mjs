#!/usr/bin/env node

// Garde-fou de la grille des offres vendeur PAR MARCHÉ (décision D-1 du
// 2026-10-08) : abonnement Certifié/Pro et boosts 3/7/15 jours.
//
// lib/utils/seller-offer-prices.ts est une des TROIS copies de la grille :
// l'app (lib/core/constants/seller_offer_prices.dart, verrouillée par
// subscription_plans_test.dart) et le dashboard (lib/subscription-grid.ts,
// qui recalcule le prix d'un abonnement côté serveur). Une copie qui dérive
// fait payer un montant différent selon le canal. Ce script échoue si le site
// s'écarte du tableau validé. Ne pas le contourner : changer la grille, c'est
// changer les trois copies ensemble.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/utils/seller-offer-prices.ts"), "utf8");

// marché: [Certifié/mois, Pro/mois, boost 3 j, boost 7 j, boost 15 j]
const expected = {
  DJ: [1500, 3500, 500, 1500, 3000],
  KM: [3000, 7500, 1250, 3750, 7500],
  SN: [4000, 10000, 1500, 5000, 10000],
  CI: [4000, 10000, 1500, 5000, 10000],
  ML: [4000, 10000, 1500, 5000, 10000],
  BF: [4000, 10000, 1500, 5000, 10000],
  CM: [4000, 10000, 1500, 5000, 10000],
  FR: [6, 15, 2.5, 7.5, 15],
  RE: [6, 15, 2.5, 7.5, 15],
  YT: [6, 15, 2.5, 7.5, 15],
  MG: [30000, 75000, 12500, 37500, 75000],
  KE: [900, 2300, 400, 1100, 2300],
  ET: [1000, 2500, 400, 1200, 2500],
  TZ: [18000, 45000, 7500, 22000, 45000],
  MR: [250, 650, 100, 350, 650],
  SO: [4000, 10000, 2000, 5000, 10000],
};

// Évalue les constantes du fichier (types retirés) sans dépendance.
const start = source.indexOf("const FCFA");
const end = source.indexOf("};", source.indexOf("export const SELLER_OFFER_PRICES")) + 2;
if (start < 0 || end < 2) {
  console.error("✗ Grille introuvable dans lib/utils/seller-offer-prices.ts");
  process.exit(1);
}
const body = source
  .slice(start, end)
  .replace(/export /g, "")
  .replace(/:\s*OfferPrices\b/g, "")
  .replace(/:\s*Record<string,\s*OfferPrices>/g, "");
const grid = new Function(`${body}; return SELLER_OFFER_PRICES;`)();

const failures = [];
const keys = Object.keys(grid).sort().join(",");
if (keys !== Object.keys(expected).sort().join(",")) {
  failures.push(`marchés : ${keys} ≠ ${Object.keys(expected).sort().join(",")}`);
}
for (const [market, v] of Object.entries(expected)) {
  const g = grid[market];
  if (!g) continue;
  const got = [g.certifiedMonthly, g.proMonthly, g.boost3Days, g.boost7Days, g.boost15Days];
  if (got.join("/") !== v.join("/")) failures.push(`${market} : ${got.join(" / ")} ≠ ${v.join(" / ")}`);
}
if (!/YEARLY_PAID_MONTHS = 10\b/.test(source)) failures.push("annuel ≠ 10 mois payés");

// Retrait minimum (DV-1, 2026-10-08) : miroir de l'app et du serveur.
const minExpected = {
  KM: 5000, DJ: 2000, SN: 7000, CI: 7000, ML: 7000, BF: 7000, CM: 7000,
  FR: 10, RE: 10, YT: 10, MG: 50000, KE: 1500, ET: 1500, TZ: 30000, MR: 500, SO: 7000,
};
const minStart = source.indexOf("export const MIN_WITHDRAWAL_BY_MARKET");
if (minStart < 0) {
  failures.push("MIN_WITHDRAWAL_BY_MARKET introuvable");
} else {
  const open = source.indexOf("{", minStart);
  const close = source.indexOf("};", open);
  const minGrid = new Function("return " + source.slice(open, close + 1) + ";")();
  for (const [m, v] of Object.entries(minExpected)) {
    if (minGrid[m] !== v) failures.push(`retrait minimum ${m} : ${minGrid[m]} ≠ ${v}`);
  }
  if (Object.keys(minGrid).length !== 16) failures.push(`retrait minimum : ${Object.keys(minGrid).length} marchés ≠ 16`);
}

if (failures.length) {
  console.error("✗ Grille des offres vendeur : écart avec la grille validée le 2026-10-08");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("OK : grille des offres vendeur alignée (16 marchés, abonnements + boosts, annuel = 10 mois, retrait minimum).");
