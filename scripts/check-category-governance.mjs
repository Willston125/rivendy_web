#!/usr/bin/env node
/**
 * Garde-fou : les catégories réservées à Rivendy ne doivent JAMAIS être
 * proposées à un vendeur (Lot P, 2026-09-02).
 *
 * Équivalent web de `test/features/products/category_governance_test.dart`.
 * Le dépôt web n'a pas de lanceur de tests : ce script sans dépendance fait
 * le même travail et tourne avec `npm run check:categories`, ou `npm run check`
 * qui l'enchaîne au typecheck. Volontairement PAS accroché à `npm run lint` :
 * eslint sort en code 1 sur les 13 erreurs de référence du dépôt, un `&&`
 * n'aurait donc jamais atteint ce garde-fou.
 *
 * Ce qu'il vérifie :
 *   1. `RIVENDY_MANAGED_CATEGORY_IDS` contient bien les trois catégories
 *      réservées — miroir de `kRivendyManagedCategories` côté app ;
 *   2. `VENDOR_CATEGORIES` n'en contient aucune ;
 *   3. aucun formulaire vendeur n'itère sur `CATEGORIES` (la liste complète)
 *      au lieu de `VENDOR_CATEGORIES`.
 *
 * Le point 3 est celui qui compte : le bug corrigé aujourd'hui venait de là.
 * `create-store-form.tsx` affichait `CATEGORIES.map(...)`, donc Alimentation,
 * Pharmacie et Hôtels — et la règle §1.10, respectée côté app depuis le
 * 2026-08-23, ne l'était pas côté web.
 */
import { readFileSync } from "node:fs";

const RESERVED = ["alimentation", "hotel", "pharmacie"];

/** Fichiers où un vendeur CHOISIT une catégorie. */
const SELLER_FORMS = [
  "features/products/product-form.tsx",
  "features/seller/create-store-form.tsx",
];

const errors = [];

// ── 1 & 2. La source unique ──────────────────────────────────────────────
const types = readFileSync("types/rivendy.ts", "utf8");

for (const id of RESERVED) {
  const declared = new RegExp(`RIVENDY_MANAGED_CATEGORY_IDS[\\s\\S]{0,200}?"${id}"`).test(types);
  if (!declared) {
    errors.push(
      `types/rivendy.ts : « ${id} » absente de RIVENDY_MANAGED_CATEGORY_IDS. ` +
      `Les trois catégories réservées doivent y figurer (miroir de ` +
      `kRivendyManagedCategories côté app).`,
    );
  }
}

if (!/export const VENDOR_CATEGORIES[\s\S]{0,300}?RIVENDY_MANAGED_CATEGORY_IDS/.test(types)) {
  errors.push(
    "types/rivendy.ts : VENDOR_CATEGORIES doit se DÉRIVER de " +
    "RIVENDY_MANAGED_CATEGORY_IDS, jamais lister les exclusions à la main — " +
    "c'est ainsi qu'« alimentation » avait été oubliée.",
  );
}

// ── 3. Les formulaires vendeur ───────────────────────────────────────────
for (const file of SELLER_FORMS) {
  const src = readFileSync(file, "utf8");

  // `CATEGORIES.map` précédé d'autre chose que VENDOR_ ou SUB_ = liste complète.
  for (const match of src.matchAll(/([A-Z_]*)CATEGORIES\.map/g)) {
    const prefix = match[1];
    if (prefix !== "VENDOR_" && prefix !== "SUB" && prefix !== "LOCATION_") {
      errors.push(
        `${file} : itère sur \`${prefix}CATEGORIES\` — un vendeur se verrait ` +
        `proposer les catégories réservées à Rivendy. Utiliser VENDOR_CATEGORIES.`,
      );
    }
  }

  if (!src.includes("isRivendyManagedCategory")) {
    errors.push(
      `${file} : garde-fou de soumission absent. Appeler ` +
      `isRivendyManagedCategory() avant d'écrire en base (défense en profondeur : ` +
      `le menu déroulant peut être repeuplé par erreur).`,
    );
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error("\n❌ Gouvernance des catégories — règle §1.10 violée :\n");
  for (const e of errors) console.error(`   • ${e}`);
  console.error(
    "\nRappel : Alimentation, Hôtels et Pharmacie sont publiées par Rivendy " +
    "depuis le dashboard uniquement. « Réservée » vise la SAISIE, pas " +
    "l'affichage — elles restent visibles côté acheteur.\n",
  );
  process.exit(1);
}

console.log("✅ Gouvernance des catégories : les 3 catégories réservées sont hors des formulaires vendeur.");
