#!/usr/bin/env node
/**
 * Garde-fou : aucune classe utilitaire de couleur ne doit rester sans regle CSS.
 *
 * POURQUOI. Tailwind v4 n'ouvre pas tailwind.config.ts. Une classe dont la
 * couleur n'est declaree nulle part (ni built-in, ni bloc @theme) ne produit
 * AUCUNE regle et disparait en silence : pas d'erreur, pas de warning, pas de
 * lint. Le 2026-09-04, 449 couleurs sont ainsi devenues invisibles sur le
 * dashboard et personne ne l'a vu avant que le proprietaire n'ouvre la page.
 * Un modificateur d'opacite mal ecrit (bg-[#xxx]/07 au lieu de /[0.07]) a le
 * meme effet, en silence lui aussi.
 *
 * METHODE. On compile la vraie feuille du projet, puis on confronte chaque
 * classe de couleur ecrite en dur dans le code aux selecteurs reellement emis.
 * On ne se fie jamais a l'absence d'erreur de build.
 *
 * Usage : node scripts/check-dead-classes.mjs [chemin/globals.css] [dossiers...]
 */
import postcss from 'postcss';
import tw from '@tailwindcss/postcss';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const cssArg = process.argv[2] || 'app/globals.css';
const cssPath = path.resolve(root, cssArg);
const dirs = process.argv.slice(3);
const roots = (dirs.length ? dirs : ['app', 'components', 'features', 'lib', 'services'])
  .map(d => path.join(root, d)).filter(fs.existsSync);

if (!fs.existsSync(cssPath)) {
  console.error(`feuille introuvable : ${cssArg}`);
  process.exit(2);
}

const files = [];
for (const r of roots) (function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts|jsx|js|mdx|html)$/.test(e.name)) files.push(p);
  }
})(r);

// Classes candidates : jetons de forme utilitaire portant une couleur.
// On ne decoupe PAS sur ':' — cela casserait hover:bg-x en deux et ferait
// passer une classe vivante pour morte.
const UTIL = /^(?:[a-z][a-z0-9]*:)*(?:-?[a-z][a-z0-9]*)(?:-[a-z0-9.[\]#%()/_-]+)*$/i;
const COLOR = /^(?:[a-z][a-z0-9]*:)*(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|decoration|divide|accent|caret|placeholder)-/;
const cands = new Map();
const dyn = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]{0,600}?)\})/g)) {
    const blob = m[1] || m[2] || m[3] || '';
    if (m[3] && /-\$\{/.test(m[3])) dyn.set(m[3].replace(/\s+/g, ' ').slice(0, 100), f);
    for (const raw of blob.split(/[\s`'"{}(),]+/)) {
      const t = raw.trim().replace(/^[?:]+|[?:]+$/g, '');
      if (t && t.length <= 60 && UTIL.test(t) && COLOR.test(t) && !cands.has(t)) cands.set(t, f);
    }
  }
}

const css = fs.readFileSync(cssPath, 'utf8') + roots.map(d => `\n@source "${d}";`).join('');
const out = await postcss([tw()]).process(css, { from: cssPath });
const flat = out.css.replace(/\\/g, '');

const dead = [];
for (const [c, f] of cands) {
  const esc = c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  if (!new RegExp('\\.' + esc + '(?![a-zA-Z0-9_-])').test(flat)) dead.push([c, path.relative(root, f)]);
}

console.log(`${files.length} fichiers · ${cands.size} classes de couleur · ${(out.css.length / 1024) | 0} Ko de CSS produit`);
if (dyn.size) {
  console.log(`\n${dyn.size} classe(s) composee(s) a l'execution — Tailwind ne peut pas les voir, verifier a l'oeil :`);
  for (const [s, f] of [...dyn].slice(0, 10)) console.log(`  ${path.relative(root, f)}\n    ${s}`);
}
if (!dead.length) {
  console.log('\nOK : toutes les classes de couleur produisent leur regle.');
  process.exit(0);
}
console.error(`\nECHEC — ${dead.length} classe(s) sans aucune regle CSS :`);
for (const [c, f] of dead.sort()) console.error(`  ${c.padEnd(34)} ${f}`);
console.error("\nCes elements s'affichent sans couleur. Declarer la couleur dans le bloc @theme");
console.error('de la feuille globale, ou corriger la classe (un modificateur d\'opacite s\'ecrit /70 ou /[0.07]).');
process.exit(1);
