import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canAddMore, cappedQuantity, cartMarkets, hasVariants, variantOptions } from "./cart-logic.ts";

test("quantité plafonnée au stock (WEB-5)", () => {
  assert.equal(cappedQuantity({ stock_quantity: 3 }, 5), 3);
  assert.equal(cappedQuantity({ stock_quantity: 3 }, 2), 2);
  assert.equal(cappedQuantity({ stock_quantity: 0 }, 1), 0);
});

test("stock non renseigné : pas de plafond inventé", () => {
  assert.equal(cappedQuantity({ stock_quantity: null }, 5), 5);
  assert.equal(cappedQuantity({}, 5), 5);
  assert.equal(canAddMore({}, 50), true);
});

test("le bouton « + » s'arrête au dernier article disponible", () => {
  assert.equal(canAddMore({ stock_quantity: 3 }, 2), true);
  assert.equal(canAddMore({ stock_quantity: 3 }, 3), false);
  assert.equal(canAddMore({ stock_quantity: 0 }, 0), false);
});

test("tailles et couleurs : séparées par des virgules, espaces retirés (WEB-4)", () => {
  const product = { extra_attributes: { sizes: "S, M ,L", colors: "Rouge,,Bleu" } };
  assert.deepEqual(variantOptions(product), { sizes: ["S", "M", "L"], colors: ["Rouge", "Bleu"] });
  assert.equal(hasVariants(product), true);
});

test("sans variante déclarée : rien à choisir", () => {
  assert.deepEqual(variantOptions({ extra_attributes: null }), { sizes: [], colors: [] });
  assert.equal(hasVariants({}), false);
});

test("marchés d'un panier : distincts, sans les articles sans marché (WEB-2)", () => {
  const item = (country_id) => ({ product: { country_id } });
  assert.deepEqual(cartMarkets([item("KM"), item("DJ"), item("KM"), item(null)]), ["KM", "DJ"]);
  assert.deepEqual(cartMarkets([item(null)]), []);
});
