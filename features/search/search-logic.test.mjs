import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ilikeOrFilter, searchPattern } from "./search-logic.ts";

const columns = ["title", "description"];

/** ILIKE de Postgres, simulé : `%` = n'importe quelle suite, sans tenir compte de la casse. */
function ilike(text, pattern) {
  const body = pattern.split("%").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}$`, "isu").test(text);
}

// Titres relevés sur www.rivendy.com le 26/11 (recherche « robe », Comores).
const titles = ["Robe", "Robe Mkoumi", "Robe Mkoumi droite", "Robe brocard", "Robe de nuit", "robe de soirée", "Robe sahare samba"];
const found = (q) => titles.filter((t) => ilike(t, searchPattern(q)));

test("recherche simple : une condition par colonne", () => {
  assert.equal(ilikeOrFilter(columns, " robe "), 'title.ilike."%robe%",description.ilike."%robe%"');
});

test("ponctuation et espaces ignorés entre les mots (audit 22, MKWEB-3)", () => {
  assert.equal(searchPattern("robe."), "%robe%");
  assert.equal(searchPattern("(mkoumi)"), "%mkoumi%");
  assert.equal(searchPattern("iPhone 13 (128 Go)"), "%iPhone%13%128%Go%");
  assert.equal(searchPattern("t.shirt"), "%t%shirt%");
  assert.equal(searchPattern("2.5 L"), "%2%5%L%");
  assert.equal(ilikeOrFilter(["title"], "robe (rouge), taille 1.5"), 'title.ilike."%robe%rouge%taille%1%5%"');
});

test("les recherches mesurées le 23/11 trouvent leurs articles", () => {
  assert.deepEqual(found("(mkoumi)"), ["Robe Mkoumi", "Robe Mkoumi droite"]);
  for (const q of ["robe.", "robe:", "robe (", "robe)"]) assert.equal(found(q).length, titles.length, q);
  assert.deepEqual(found("Robe-de-nuit"), ["Robe de nuit"]);
  assert.ok(ilike("iPhone 13 (128 Go) noir", searchPattern("iPhone 13 128 Go")));
  assert.ok(ilike("T-shirt blanc", searchPattern("t.shirt")));
  assert.ok(ilike("Bidon 2,5 L", searchPattern("2.5 L")));
});

test("les mots restent dans l'ordre", () => {
  assert.deepEqual(found("nuit robe"), []);
});

test("% et _ ne sont jamais des jokers de l'utilisateur", () => {
  assert.equal(ilikeOrFilter(["title"], "50%"), 'title.ilike."%50%"');
  assert.equal(searchPattern("t_shirt"), "%t%shirt%");
  assert.equal(searchPattern("a%b_c"), "%a%b%c%");
});

test("guillemets et barres obliques inverses : séparateurs, jamais dans le filtre", () => {
  assert.equal(ilikeOrFilter(["title"], 'écran 15" \\ noir'), 'title.ilike."%écran%15%noir%"');
});

test("accents et signes diacritiques gardés, en forme composée", () => {
  assert.equal(searchPattern("Thé à la menthe"), "%Thé%à%la%menthe%");
  assert.equal(searchPattern("café"), "%café%"); // é décomposé → composé (NFC)
  const arabe = "بَيْت";
  assert.equal(searchPattern(arabe), `%${arabe.normalize("NFC")}%`);
});

test("ponctuation seule : cherchée telle quelle, comme avant", () => {
  assert.equal(ilikeOrFilter(["title"], '..."'), 'title.ilike."%...\\"%"');
});

test("motif borné à 10 mots", () => {
  assert.equal(searchPattern("a b c d e f g h i j k l"), "%a%b%c%d%e%f%g%h%i%j%");
});

test("rien à chercher", () => {
  assert.equal(ilikeOrFilter(columns, "   "), null);
  assert.equal(ilikeOrFilter(columns, "%%"), null);
  assert.equal(ilikeOrFilter(columns, "_ %"), null);
});
