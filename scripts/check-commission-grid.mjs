#!/usr/bin/env node

// Garde-fou de la grille de commission PAR PRIX (décision du 2026-10-02).
//
// lib/utils/commission.ts n'est qu'une des QUATRE copies de la grille
// (PROTECTED_ZONES §1.4) : la base (commission_price_tiers, qui fait foi),
// l'app (commission_service.dart) et le dashboard (lib/commission-grid.ts).
// Une copie qui dérive fait afficher au vendeur un montant que la base ne
// facturera pas — l'erreur qui avait fait retirer la grille par montant en
// juillet 2026. Ce script échoue si les seuils, taux ou pas d'arrondi du site
// s'écartent du tableau validé par le propriétaire. Ne pas le contourner :
// changer la grille, c'est changer les quatre copies ensemble.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/utils/commission.ts"), "utf8");
const failures = [];

// marché: [seuil 6 %→8 %, seuil 8 %→10 %, pas d'arrondi]
const expected = {
  KM: [50000, 500000, 50],
  DJ: [20000, 200000, 50],
  SN: [50000, 500000, 50],
  CI: [50000, 500000, 50],
  ML: [50000, 500000, 50],
  BF: [50000, 500000, 50],
  CM: [50000, 500000, 50],
  FR: [100, 1000, 0.5],
  RE: [100, 1000, 0.5],
  YT: [100, 1000, 0.5],
  MG: [500000, 5000000, 100],
  KE: [15000, 150000, 10],
  ET: [15000, 150000, 5],
  TZ: [300000, 3000000, 100],
  MR: [5000, 50000, 10],
  SO: [50000, 500000, 1000],
};

const block = source.match(/PRICE_TIERS:\s*Record<string,\s*PriceTiers>\s*=\s*\{([\s\S]*?)\n\};/);
if (!block) {
  failures.push("PRICE_TIERS introuvable dans lib/utils/commission.ts.");
} else {
  const found = {};
  for (const m of block[1].matchAll(/(\w{2}):\s*\{\s*low:\s*([\d.]+),\s*high:\s*([\d.]+),\s*step:\s*([\d.]+)\s*\}/g)) {
    found[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  for (const [country, values] of Object.entries(expected)) {
    if (JSON.stringify(found[country]) !== JSON.stringify(values)) {
      failures.push(`${country} : attendu ${JSON.stringify(values)}, trouvé ${JSON.stringify(found[country] ?? null)}.`);
    }
  }
  for (const country of Object.keys(found)) {
    if (!(country in expected)) failures.push(`${country} : marché absent du tableau validé.`);
  }
}

if (!/const RATES = \{ low: 6, mid: 8, high: 10 \}/.test(source)) {
  failures.push("RATES doit valoir { low: 6, mid: 8, high: 10 } (6 % / 8 % / 10 % par portion).");
}
if (!/const MIN_STEPS = 1\b/.test(source)) {
  failures.push("MIN_STEPS doit valoir 1 (commission minimale = 1 pas).");
}

if (failures.length > 0) {
  console.error("Grille de commission du site désalignée :\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`OK : grille de commission par prix alignée (${Object.keys(expected).length} marchés, 6/8/10 %, minimum 1 pas).`);
