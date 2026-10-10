// Contrôle des miroirs du mode « Sur commande » (2026-10-10).
//
// La liste des catégories où un article peut être vendu sur commande, et les
// délais proposés, vivent en CINQ endroits qui doivent rester identiques :
//   • site      lib/utils/preorder-mode.ts           (ce dépôt)
//   • app       ../rivendy_app/lib/features/products/logic/preorder_mode.dart
//   • dashboard ../rivendy_dashboard/lib/product-move.ts   (déplacement)
//   • base      ../rivendy_dashboard/supabase/migrations/20261010_preorder_seller_publish.sql
//               (guard_product_insert) et 20261010_preorder_seller_edit.sql
//               (guard_product_privileges).
// Une copie qui diverge propose au vendeur un choix que la base refuse (la
// publication échoue sans explication), ou laisse la base accepter ce que
// l'écran n'offre pas.
//
// Usage : node scripts/check-preorder-mirror.mjs  (lancé par npm run check)
// Les dépôts voisins n'existent que sur le poste du propriétaire : ailleurs
// (CI, Vercel), seule la copie du site est contrôlée, et on le dit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '..');
const ROOT = path.resolve(WEB, '..');
const MAX_DAYS = 90; // borne de la base (22003 au-delà)

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const quoted = (s) => [...s.matchAll(/['"]([A-Za-z]+)['"]/g)].map((m) => m[1]).sort();
const failures = [];

function listAfter(src, marker, open, close, label) {
  const at = src.indexOf(marker);
  if (at < 0) { failures.push(`${label} : « ${marker} » introuvable`); return null; }
  const start = src.indexOf(open, at);
  const end = src.indexOf(close, start);
  return quoted(src.slice(start + 1, end));
}

function daysAfter(src, marker, label) {
  const at = src.indexOf(marker);
  if (at < 0) { failures.push(`${label} : « ${marker} » introuvable`); return null; }
  const start = src.indexOf('[', at);
  const block = src.slice(start, src.indexOf(']', start));
  // Une option par ligne : null (« à confirmer ») ou un nombre de jours.
  return [...block.matchAll(/(?:days:\s*|PreorderDelayOption\()\s*(null|\d+)/g)].map((m) => m[1]);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Site (toujours) ────────────────────────────────────────────────────────
const webSrc = read(path.join(WEB, 'lib/utils/preorder-mode.ts'));
const web = listAfter(webSrc, 'PREORDER_ELIGIBLE_CATEGORY_IDS', '= [', ']', 'site'); // '= [' : le type porte déjà « [] »
const webDays = daysAfter(webSrc, 'PREORDER_DELAY_OPTIONS', 'site');
for (const d of webDays ?? []) {
  if (d !== 'null' && (Number(d) < 1 || Number(d) > MAX_DAYS)) failures.push(`site : délai ${d} j hors de 1–${MAX_DAYS}`);
}
for (const reserved of ['alimentation', 'hotel', 'pharmacie']) {
  if (web?.includes(reserved)) failures.push(`site : « ${reserved} » est réservée à Rivendy`);
}

// ── Miroirs voisins (poste du propriétaire) ────────────────────────────────
const appFile = path.join(ROOT, 'rivendy_app/lib/features/products/logic/preorder_mode.dart');
const moveFile = path.join(ROOT, 'rivendy_dashboard/lib/product-move.ts');
const sqlInsert = path.join(ROOT, 'rivendy_dashboard/supabase/migrations/20261010_preorder_seller_publish.sql');
const sqlEdit = path.join(ROOT, 'rivendy_dashboard/supabase/migrations/20261010_preorder_seller_edit.sql');
const neighbours = [appFile, moveFile, sqlInsert, sqlEdit];

if (neighbours.some((f) => !fs.existsSync(f))) {
  console.warn('Mode « Sur commande » : dépôts voisins absents — seule la copie du site est contrôlée.');
} else {
  const appSrc = read(appFile);
  const moveSrc = read(moveFile);
  const copies = {
    app: listAfter(appSrc, 'kPreorderEligibleCategoryKeys', '{', '}', 'app'),
    'dashboard (déplacement)': listAfter(moveSrc, 'MOVABLE_CATEGORY_IDS', '[', ']', 'dashboard'),
    'base (publication)': listAfter(read(sqlInsert), 'NEW.category NOT IN', '(', ')', 'SQL publication'),
    'base (modification)': listAfter(read(sqlEdit), 'NEW.category NOT IN', '(', ')', 'SQL modification'),
  };
  for (const [name, list] of Object.entries(copies)) {
    if (list && web && !same(list, web)) {
      failures.push(`${name} ≠ site\n    site : ${web.join(', ')}\n    ${name} : ${list.join(', ')}`);
    }
  }
  const appDays = daysAfter(appSrc, 'kPreorderDelayOptions', 'app');
  const dashDays = daysAfter(moveSrc, 'PREORDER_DELIVERY_OPTIONS', 'dashboard');
  if (appDays && webDays && !same(appDays, webDays)) failures.push(`délais app (${appDays}) ≠ site (${webDays})`);
  if (dashDays && webDays && !same(dashDays, webDays)) failures.push(`délais dashboard (${dashDays}) ≠ site (${webDays})`);
}

if (failures.length > 0) {
  console.error('ÉCHEC — mode « Sur commande » : les copies divergent.\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log(`OK : mode « Sur commande » aligné (${web.length} catégories, ${webDays.length} délais).`);
