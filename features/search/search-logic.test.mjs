import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ilikeOrFilter } from "./search-logic.ts";

const columns = ["title", "description"];

test("recherche simple : une condition par colonne", () => {
  assert.equal(ilikeOrFilter(columns, " robe "), 'title.ilike."%robe%",description.ilike."%robe%"');
});

test("caractères réservés de PostgREST : gardés, entre guillemets (WEB-17)", () => {
  assert.equal(ilikeOrFilter(["title"], "robe (rouge), taille 1.5"), 'title.ilike."%robe (rouge), taille 1.5%"');
});

test("guillemets et barres obliques inverses échappés", () => {
  assert.equal(ilikeOrFilter(["title"], 'écran 15" \\ noir'), 'title.ilike."%écran 15\\" \\\\ noir%"');
});

test("le joker % n'est pas laissé à l'utilisateur", () => {
  assert.equal(ilikeOrFilter(["title"], "50%"), 'title.ilike."%50%"');
});

test("rien à chercher", () => {
  assert.equal(ilikeOrFilter(columns, "   "), null);
  assert.equal(ilikeOrFilter(columns, "%%"), null);
});
