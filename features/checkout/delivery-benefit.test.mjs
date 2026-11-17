// Réduction de livraison au panier — règles pures (formules simplifiées, lot 3, 2026-11-17).
// node --test features/checkout/delivery-benefit.test.mjs  (npm run check:delivery)
import { test } from "node:test";
import assert from "node:assert/strict";
import { benefitSentence, deliveryDisplay, orderTotals } from "./delivery-benefit.ts";

const KMF = (n) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} KMF`;
// Règles de Grande Comore (grille du 15/11), comme les rend rivendy_delivery_quote.
const PLUS = { credits_per_cycle: 2, credit_full_until: 500, credit_partial_percent: 50,
  half_threshold: 25000, half_percent: 50, full_threshold: 35000, currency: "KMF" };
const FREE = { credits_per_cycle: 0, credits_remaining: 0, credit_full_until: 0, credit_partial_percent: 0,
  half_threshold: 25000, half_percent: 50, full_threshold: 0, currency: "KMF" };
const quote = (over) => ({ success: true, ...over });

test("Rivendy+, zone à 500 KMF : livraison offerte, 1 sur 2", () => {
  const d = deliveryDisplay(quote({ ...PLUS, benefit: "credit", fee_full: 500, rivendy_share: 500, buyer_fee: 0,
    credits_remaining: 2 }), 500, 12000, KMF);
  assert.equal(d.buyerFee, 0);
  assert.equal(d.label, "Offerte par Rivendy+");
  assert.equal(d.detail, "Livraison offerte : 1 sur 2 ce mois-ci.");
  assert.equal(d.nudge, null);
});

test("Rivendy+, zone à 3 000 KMF : moitié offerte, et le seuil de 35 000 proposé", () => {
  const d = deliveryDisplay(quote({ ...PLUS, benefit: "credit", fee_full: 3000, rivendy_share: 1500, buyer_fee: 1500,
    credits_remaining: 1 }), 3000, 24000, KMF);
  assert.equal(d.label, "Moitié offerte par Rivendy+");
  assert.equal(d.detail, "Livraison offerte : 2 sur 2 ce mois-ci. Au-delà de 500 KMF de livraison, elle en paie la moitié.");
  assert.equal(d.buyerFee, 1500);
  assert.equal(d.nudge, "Encore 11 000 KMF d’articles : la livraison est offerte.");
});

test("Rivendy+, 35 000 KMF ou plus : offerte par le seuil, livraisons du mois gardées", () => {
  const d = deliveryDisplay(quote({ ...PLUS, benefit: "full_threshold", fee_full: 3000, rivendy_share: 3000, buyer_fee: 0,
    credits_remaining: 2 }), 3000, 36000, KMF);
  assert.equal(d.label, "Offerte dès 35 000 KMF d’articles");
  assert.equal(d.detail, "Vos livraisons offertes du mois restent pour une autre commande.");
  assert.equal(d.buyerFee, 0);
});

test("compte gratuit, 25 000 KMF ou plus : moitié payée par Rivendy", () => {
  const d = deliveryDisplay(quote({ ...FREE, benefit: "half_threshold", fee_full: 1000, rivendy_share: 500, buyer_fee: 500 }),
    1000, 27500, KMF);
  assert.equal(d.label, "Moitié payée par Rivendy");
  assert.equal(d.detail, "Commande de 25 000 KMF ou plus.");
  assert.equal(d.nudge, null);
});

test("compte gratuit, sous 25 000 KMF : coup de pouce seulement près du seuil", () => {
  const near = deliveryDisplay(quote({ ...FREE, benefit: null, fee_full: 1000, rivendy_share: 0, buyer_fee: 1000 }),
    1000, 21500, KMF);
  assert.equal(near.label, null);
  assert.equal(near.nudge, "Encore 3 500 KMF d’articles : Rivendy paie la moitié de la livraison.");
  const far = deliveryDisplay(quote({ ...FREE, benefit: null, fee_full: 1000, rivendy_share: 0, buyer_fee: 1000 }),
    1000, 5000, KMF);
  assert.equal(far.nudge, null);
});

test("aperçu absent, en panne ou périmé : tarif plein, rien promis", () => {
  assert.deepEqual(deliveryDisplay(null, 1000, 30000, KMF),
    { feeFull: 1000, share: 0, buyerFee: 1000, label: null, detail: null, nudge: null });
  assert.equal(deliveryDisplay({ success: false, error: "unauthenticated" }, 1000, 30000, KMF).share, 0);
  // Aperçu calculé pour un autre tarif (adresse changée) : ignoré.
  assert.equal(deliveryDisplay(quote({ ...FREE, benefit: "half_threshold", fee_full: 500, rivendy_share: 250 }), 1000, 30000, KMF).share, 0);
  assert.equal(deliveryDisplay(quote({ ...FREE, fee_full: 0 }), 0, 30000, KMF).buyerFee, 0);
});

test("Djibouti : aucun seuil, aucun coup de pouce", () => {
  const d = deliveryDisplay(quote({ credits_per_cycle: 0, half_threshold: 0, full_threshold: 0, benefit: null,
    fee_full: 500, rivendy_share: 0, buyer_fee: 500 }), 500, 40000, (n) => `${n} FDJ`);
  assert.deepEqual([d.label, d.detail, d.nudge, d.buyerFee], [null, null, null, 500]);
});

test("totaux après commande : une seule commande", () => {
  const t = orderTotals([{ total_price: 12000, delivery_fee_kmf: 0, delivery_fee_full: 500, delivery_rivendy_share: 500,
    delivery_benefit: "credit", delivery_group: null }]);
  assert.deepEqual(t, { products: 12000, feeFull: 500, share: 500, buyerFee: 0, benefit: "credit", amountDue: 12000 });
});

test("totaux après commande : panier chez deux vendeurs, le dernier recalcul fait foi", () => {
  const t = orderTotals([
    { total_price: "16000.00", delivery_fee_kmf: 1500, delivery_fee_full: 1500, delivery_rivendy_share: 0, delivery_benefit: null },
    { total_price: 10000, delivery_fee_kmf: 0, delivery_fee_full: 0, delivery_rivendy_share: 0,
      delivery_group: { fee_full: 1500, rivendy_share: 750, buyer_fee: 750, benefit: "half_threshold" } },
  ]);
  assert.deepEqual(t, { products: 26000, feeFull: 1500, share: 750, buyerFee: 750, benefit: "half_threshold", amountDue: 26750 });
});

test("totaux après commande : retrait sur place, sans livraison", () => {
  assert.deepEqual(orderTotals([{ total_price: 5000 }]),
    { products: 5000, feeFull: 0, share: 0, buyerFee: 0, benefit: null, amountDue: 5000 });
});

test("phrase de la part payée par Rivendy", () => {
  assert.equal(benefitSentence("credit", 500, KMF), "Rivendy+ vous offre 500 KMF de livraison.");
  assert.equal(benefitSentence("half_threshold", 750, KMF), "Rivendy paie 750 KMF de la livraison.");
  assert.equal(benefitSentence("full_threshold", 3000, KMF), "Livraison offerte : Rivendy paie 3 000 KMF.");
  assert.equal(benefitSentence(null, 0, KMF), null);
});
