// Génère les référentiels « annonces métier » du site depuis l'app Flutter :
//   ../rivendy_app/lib/features/products/models/phase_b_listings.dart
//   ../rivendy_app/lib/features/products/models/construction_subcategory.dart
// → lib/listings/phase-b-listings.generated.ts
// → lib/listings/construction-subcategories.generated.ts
//
// Pourquoi : avant le 2026-10-04 le site publiait les annonces Location,
// Mariage, Restaurant, Personnels et Construction SANS sous-type ni champs
// métier. Elles échappaient alors aux filtres de ces univers, sur les DEUX
// clients. Recopier ~1 300 lignes de constantes à la main aurait recréé le
// piège §1.10 (deux listes qui divergent) : on les GÉNÈRE depuis la source.
//
// Usage (depuis rivendy_web) :  node scripts/sync-listings-from-app.mjs
//   --check : n'écrit rien, échoue si les fichiers générés ne sont plus à jour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '..');
const APP_MODELS = path.resolve(WEB, '../rivendy_app/lib/features/products/models');
const CHECK = process.argv.includes('--check');

// Le dépôt de l'app vit à côté (../rivendy_app) sur le poste du propriétaire.
// Ailleurs (CI, Vercel), on ne peut pas comparer : on le dit, sans échouer.
if (!fs.existsSync(APP_MODELS)) {
  console.warn(`Référentiels métier : ${APP_MODELS} introuvable — vérification ignorée.`);
  process.exit(0);
}

// ── Mini-analyseur pour le sous-ensemble Dart utilisé par ces constantes ──
function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let out = '';
      while (src[j] !== c) {
        if (src[j] === '\\') { const n = src[j + 1]; out += n === 'n' ? '\n' : n; j += 2; continue; }
        out += src[j++];
      }
      tokens.push({ t: 'str', v: out });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; while (/[0-9.]/.test(src[j])) j++;
      tokens.push({ t: 'num', v: Number(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (/[A-Za-z0-9_.]/.test(src[j])) j++;
      tokens.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
    }
    if ('()[],:;'.includes(c)) { tokens.push({ t: c }); i++; continue; }
    throw new Error(`Caractère inattendu « ${c} » à ${i}`);
  }
  return tokens;
}

function parseValue(tokens, pos) {
  let tok = tokens[pos];
  if (tok.t === 'id' && tok.v === 'const') tok = tokens[++pos];
  if (tok.t === 'str') {
    // concaténation implicite de littéraux adjacents ('a' 'b')
    let v = tok.v; pos++;
    while (tokens[pos]?.t === 'str') v += tokens[pos++].v;
    return [v, pos];
  }
  if (tok.t === 'num') return [tok.v, pos + 1];
  if (tok.t === '[') {
    const arr = []; pos++;
    while (tokens[pos].t !== ']') {
      const [v, p] = parseValue(tokens, pos); arr.push(v); pos = p;
      if (tokens[pos].t === ',') pos++;
    }
    return [arr, pos + 1];
  }
  if (tok.t === 'id') {
    if (tokens[pos + 1]?.t === '(') {
      const obj = { __type: tok.v }; pos += 2;
      while (tokens[pos].t !== ')') {
        if (tokens[pos].t === 'id' && tokens[pos + 1]?.t === ':') {
          const name = tokens[pos].v;
          const [v, p] = parseValue(tokens, pos + 2); obj[name] = v; pos = p;
        } else {
          const [, p] = parseValue(tokens, pos); pos = p; // argument positionnel ignoré
        }
        if (tokens[pos].t === ',') pos++;
      }
      return [obj, pos + 1];
    }
    if (tok.v === 'true' || tok.v === 'false') return [tok.v === 'true', pos + 1];
    return [{ __ref: tok.v }, pos + 1];
  }
  throw new Error(`Jeton inattendu ${JSON.stringify(tok)} à la position ${pos}`);
}

function parseAt(src, startIndex) {
  const tokens = tokenize(src.slice(startIndex));
  return parseValue(tokens, 0)[0];
}

// ── Phase B ──────────────────────────────────────────────────────────────
const phaseBSrc = fs.readFileSync(path.join(APP_MODELS, 'phase_b_listings.dart'), 'utf8');

// Listes partagées déclarées en tête de fichier (ex. `const _roomFields = [`),
// référencées par nom dans les annonces.
const sharedLists = {};
for (const m of phaseBSrc.matchAll(/^const (_\w+) = \[/gm)) {
  const start = m.index + m[0].length - 1;
  const end = phaseBSrc.indexOf('\n];', start);
  sharedLists[m[1]] = parseAt(phaseBSrc.slice(0, end + 3), start);
}
const resolveList = (v) => (Array.isArray(v) ? v : v?.__ref && sharedLists[v.__ref]) || [];

const categories = [];
for (const m of phaseBSrc.matchAll(/const _(\w+) = PhaseBCategory\(/g)) {
  const start = m.index + m[0].length - 'PhaseBCategory('.length;
  // On isole le bloc jusqu'au « ); » de fin de constante.
  const end = phaseBSrc.indexOf('\n);', start);
  const cat = parseAt(phaseBSrc.slice(0, end + 2), start);
  categories.push({
    categoryKey: cat.categoryKey,
    label: cat.label,
    emoji: cat.emoji,
    listings: resolveList(cat.listings).map((l) => ({
      typeKey: l.typeKey,
      label: l.label,
      emoji: l.emoji,
      listingType: l.listingType,
      businessType: l.businessType ?? 'boutique',
      fields: resolveList(l.fields).map((f) => ({
        key: f.key,
        label: f.label,
        hint: f.hint ?? '',
        inputType: (f.inputType?.__ref ?? 'PhaseBInputType.text').split('.').pop(),
        options: f.options ?? [],
      })),
    })),
  });
}
if (categories.length < 4) throw new Error(`Phase B : ${categories.length} catégories lues, attendu ≥ 4`);

// ── Construction ─────────────────────────────────────────────────────────
const constrSrc = fs.readFileSync(path.join(APP_MODELS, 'construction_subcategory.dart'), 'utf8');
const allIdx = constrSrc.indexOf('static const List<ConstructionSubcategory> all = [');
if (allIdx < 0) throw new Error('Construction : liste « all » introuvable');
const listStart = constrSrc.indexOf('[', allIdx);
const listEnd = constrSrc.indexOf('\n  ];', listStart);
const constructionRaw = parseAt(constrSrc.slice(0, listEnd + 4), listStart);
const construction = constructionRaw.map((s) => ({
  key: s.key,
  label: s.label,
  emoji: s.emoji,
  fields: (s.fields ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    hint: f.hint ?? '',
    inputType: (f.inputType?.__ref ?? 'TextInputTypeHint.text').split('.').pop(),
  })),
}));
if (construction.length < 3) throw new Error(`Construction : ${construction.length} sous-catégories lues`);

// ── Écriture ─────────────────────────────────────────────────────────────
const banner = (src) => `// ⚠️ FICHIER GÉNÉRÉ — ne pas modifier à la main.
// Source : rivendy_app/lib/features/products/models/${src}
// Régénérer : node scripts/sync-listings-from-app.mjs (depuis rivendy_web)
`;

const phaseBTs = `${banner('phase_b_listings.dart')}
import type { PhaseBCategory } from "./types";

export const PHASE_B_CATEGORIES: PhaseBCategory[] = ${JSON.stringify(categories, null, 2)};
`;
const constrTs = `${banner('construction_subcategory.dart')}
import type { ConstructionSubcategory } from "./types";

export const CONSTRUCTION_SUBCATEGORIES: ConstructionSubcategory[] = ${JSON.stringify(construction, null, 2)};
`;

const outDir = path.join(WEB, 'lib/listings');
const targets = [
  [path.join(outDir, 'phase-b-listings.generated.ts'), phaseBTs],
  [path.join(outDir, 'construction-subcategories.generated.ts'), constrTs],
];
let stale = false;
for (const [file, content] of targets) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== content) {
    stale = true;
    if (!CHECK) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(file, content);
      console.log(`écrit : ${path.relative(WEB, file)}`);
    }
  }
}
const listingCount = categories.reduce((n, c) => n + c.listings.length, 0);
if (CHECK && stale) {
  console.error('Référentiels métier du site désalignés de l\'app : lancer node scripts/sync-listings-from-app.mjs');
  process.exit(1);
}
console.log(`OK : ${categories.length} univers métier, ${listingCount} types d'annonce, ${construction.length} sous-catégories construction.`);
