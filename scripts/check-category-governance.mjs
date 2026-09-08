#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

const types = read("types/rivendy.ts");
const sellerForms = [
  "features/products/product-form.tsx",
  "features/seller/create-store-form.tsx",
];

const managedBlock = types.match(
  /RIVENDY_MANAGED_CATEGORY_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
const managedIds = managedBlock
  ? [...managedBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort()
  : [];
const expectedIds = ["alimentation", "hotel", "pharmacie"].sort();

if (JSON.stringify(managedIds) !== JSON.stringify(expectedIds)) {
  failures.push(
    `RIVENDY_MANAGED_CATEGORY_IDS doit contenir exactement ${expectedIds.join(", ")}.`,
  );
}

if (!/VENDOR_CATEGORIES\s*=\s*CATEGORIES\.filter/.test(types)) {
  failures.push("VENDOR_CATEGORIES doit dériver de CATEGORIES.filter().");
}

if (!/!isRivendyManagedCategory\(category\.id\)/.test(types)) {
  failures.push("VENDOR_CATEGORIES doit utiliser isRivendyManagedCategory().");
}

for (const file of sellerForms) {
  const source = read(file);
  if (!source.includes("isRivendyManagedCategory")) {
    failures.push(`${file} doit contrôler la catégorie au moment de la soumission.`);
  }
  if (!/VENDOR_CATEGORIES\.map/.test(source)) {
    failures.push(`${file} doit afficher VENDOR_CATEGORIES.`);
  }
  if (/(^|[^A-Z_])CATEGORIES\.map/.test(source)) {
    failures.push(`${file} ne doit jamais afficher la liste complète CATEGORIES.`);
  }
}

const bulkForm = read("features/seller/create-store-form.tsx");
if (/status:\s*["']active["']/.test(bulkForm)) {
  failures.push("La création en lot ne doit jamais envoyer status=active.");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Gouvernance catégories vendeur conforme (3 catégories Rivendy protégées).");
