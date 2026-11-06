// Refus de `secure_create_order` traduits pour l'acheteur.
// node --test lib/utils/order-errors.test.mjs   (npm run check:order-errors)
// Liste tirée de la dernière définition (20261026_0900_audit21_lot2_frais_dj.sql) :
// un code ajouté côté serveur s'ajoute ici, sinon il s'affiche brut.
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderFailureMessage } from "./order-errors.ts";

const SERVER_CODES = [
  "delivery_zone_market_mismatch",
  "duplicate_order_id",
  "empty_items",
  "foreign_market",
  "incomplete_delivery_address",
  "invalid_buyer_phone",
  "invalid_price_snapshot",
  "invalid_quantity",
  "locality_region_mismatch",
  "missing_price_snapshot",
  "mixed_markets",
  "mixed_sellers",
  "neighborhood_locality_mismatch",
  "product_not_available",
  "seller_mismatch",
  "too_many_open_orders",
  "unknown_delivery_zone",
];

test("chaque refus du serveur a sa phrase, sans le code brut", () => {
  for (const code of SERVER_CODES) {
    const message = orderFailureMessage(code);
    assert.ok(!message.includes(code), code);
    assert.ok(!message.includes("code :"), code);
  }
});

test("prix à revoir : l'article est nommé quand on le connaît", () => {
  assert.match(orderFailureMessage("missing_price_snapshot", "Robe"), /« Robe »/);
  assert.match(orderFailureMessage("invalid_price_snapshot"), /d'un article/);
});

test("code inconnu : message générique, code gardé pour le support", () => {
  assert.match(orderFailureMessage("nouveau_refus"), /\(code : nouveau_refus\)$/);
});
