// Rivendy+ — règles pures (Omnicanal lot B, 2026-10-21).
// node --test features/plus/plus-logic.test.mjs  (npm run check:plus)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  offerBenefits, durationLabel, isValidPayerPhone, isValidOperatorReference,
  requestErrorMessage, declareErrorMessage, periodStatus, requestValidUntil, rejectReasons,
  DELIVERY_CREDITS_LIVE,
} from "./plus-logic.ts";

const NOW = new Date("2026-10-28T15:00:00Z");
const base = {
  id: "p1", plan: "month", price_paid: 2000, country_id: "KM", payment_method: "MVola",
  payment_reference: "RVP-7K2M9Q", payment_channel: "mvola", declared_at: null, agency_id: null,
  starts_at: null, expires_at: null, created_at: "2026-10-28T10:00:00Z",
};

test("avantages : lus dans les droits de la formule, jamais supposés", () => {
  const plus = offerBenefits({ entitlements: { play_premium: true, music_premium: true, exclusive_content: true,
    early_access: true, simultaneous_streams: 2, delivery_credits_per_cycle: 2 } });
  assert.ok(plus.includes("Films et séries Premium sur Rivendy Play"));
  assert.ok(plus.includes("2 écrans en même temps"));
  const day = offerBenefits({ entitlements: { play_premium: true, simultaneous_streams: 1 } });
  assert.ok(!day.some((b) => b.includes("écrans")));
  assert.ok(!day.includes("Contenus exclusifs"));
});

test("crédits livraison : jamais promis avant le lot F", () => {
  assert.equal(DELIVERY_CREDITS_LIVE, false);
  const b = offerBenefits({ entitlements: { delivery_credits_per_cycle: 2 } });
  assert.ok(!b.some((x) => x.includes("livraison")));
});

test("durées", () => {
  assert.equal(durationLabel(720), "30 jours");
  assert.equal(durationLabel(24), "24 heures");
  assert.equal(durationLabel(168), "7 jours");
  assert.equal(durationLabel(0), "");
});

test("contrôles du formulaire : mêmes règles que le serveur", () => {
  assert.ok(isValidPayerPhone("+269 320 11 22"));
  assert.ok(isValidPayerPhone("3201122"));
  assert.ok(!isValidPayerPhone("abc"));
  assert.ok(!isValidPayerPhone("12"));
  assert.ok(isValidOperatorReference("MP251021.1830.A1"));
  assert.ok(!isValidOperatorReference("X"));
  assert.ok(!isValidOperatorReference("x".repeat(81)));
});

test("messages d'erreur : chaque code connu a son texte, vouvoiement", () => {
  for (const c of ["not_authenticated", "sale_closed", "not_on_sale", "no_market", "channel_unavailable",
    "too_many_pending", "unknown_plan", "not_available_in_this_app"]) {
    const m = requestErrorMessage(c);
    assert.notEqual(m, requestErrorMessage("???"), c);
    assert.ok(!/\b(tu|ton|ta|tes)\b/i.test(m), c);
  }
  for (const c of ["bad_phone", "bad_operator_reference", "operator_reference_used", "already_declared",
    "request_not_pending", "not_declarable", "proof_not_found"]) {
    assert.notEqual(declareErrorMessage(c), declareErrorMessage("???"), c);
  }
});

test("statuts : à payer, à payer en agence, déclaré, actif, à venir, remboursé", () => {
  assert.equal(periodStatus({ ...base, status: "pending" }, NOW).label, "À payer");
  assert.equal(periodStatus({ ...base, status: "pending", payment_channel: "agency" }, NOW).label, "À payer en agence");
  assert.equal(periodStatus({ ...base, status: "pending", declared_at: "2026-10-28T11:00:00Z" }, NOW).tone, "pending");
  assert.equal(periodStatus({ ...base, status: "active", starts_at: "2026-10-28T11:00:00Z",
    expires_at: "2026-11-27T11:00:00Z" }, NOW).label, "Actif");
  assert.equal(periodStatus({ ...base, status: "active", starts_at: "2026-11-27T11:00:00Z",
    expires_at: "2026-12-27T11:00:00Z" }, NOW).label, "Payé — commence à la fin de la période en cours");
  assert.equal(periodStatus({ ...base, status: "active", starts_at: "2026-09-01T00:00:00Z",
    expires_at: "2026-10-01T00:00:00Z" }, NOW).label, "Terminé");
  assert.equal(periodStatus({ ...base, status: "refunded" }, NOW).label, "Remboursé");
  assert.equal(periodStatus({ ...base, status: "cancelled" }, NOW).label, "Annulé");
});

test("validité d'une demande : 7 jours", () => {
  assert.equal(requestValidUntil("2026-10-28T10:00:00Z").toISOString(), "2026-11-04T10:00:00.000Z");
});

test("motifs de refus : le plus récent par demande", () => {
  const r = rejectReasons([
    { metadata: { step: "rejected", play_pass_id: "a", reason: " Paiement introuvable " } },
    { metadata: { step: "rejected", play_pass_id: "a", reason: "ancien" } },
    { metadata: { step: "activated", play_pass_id: "b" } },
    { metadata: null },
  ]);
  assert.deepEqual(r, { a: "Paiement introuvable" });
});
