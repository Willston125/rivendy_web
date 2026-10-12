// Tests des règles du Pass Premium Rivendy Play — sous Node, sans dépendance :
//   node --test features/play/play-pass-logic.test.mjs   (npm run check:play)
// (Node ≥ 22.18 retire lui-même les types du module TypeScript importé.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PASS_PLANS,
  PASS_REFERENCE_ALPHABET,
  PASS_REFERENCE_PATTERN,
  accessUntil,
  cheapestPerDayPlan,
  generatePassReference,
  isPassSaleOpen,
  passRequestMessage,
  passStatus,
  plansOnSale,
  rejectReasons,
} from "./play-pass-logic.ts";

const KM = [
  { plan: "day", price: 500, is_on_sale: true },
  { plan: "week", price: 1500, is_on_sale: true },
  { plan: "month", price: 3000, is_on_sale: true },
];

test("tarifs en vente, dans l'ordre 24 h → 7 j → 30 j", () => {
  const shuffled = [KM[2], KM[0], KM[1]];
  assert.deepEqual(plansOnSale(shuffled).map((p) => [p.id, p.price]), [
    ["day", 500],
    ["week", 1500],
    ["month", 3000],
  ]);
  assert.deepEqual(plansOnSale([{ plan: "day", price: 500, is_on_sale: false }]), []);
  // Un prix nul ou absent n'est jamais proposé.
  assert.deepEqual(plansOnSale([{ plan: "day", price: 0, is_on_sale: true }]), []);
});

test("durées : 24 h, 7 jours, 30 jours (miroir de request_play_pass)", () => {
  assert.deepEqual(PASS_PLANS.map((p) => [p.id, p.hours]), [
    ["day", 24],
    ["week", 168],
    ["month", 720],
  ]);
});

test("meilleur prix par jour : calculé, pas supposé", () => {
  assert.equal(cheapestPerDayPlan(KM), "month"); // 100 KMF/jour
  // Grille changée au dashboard : le 7 jours devient le moins cher par jour.
  assert.equal(
    cheapestPerDayPlan([
      { plan: "day", price: 500, is_on_sale: true },
      { plan: "week", price: 350, is_on_sale: true },
      { plan: "month", price: 3000, is_on_sale: true },
    ]),
    "week",
  );
  // Égalité ou formule unique : aucun badge.
  assert.equal(
    cheapestPerDayPlan([
      { plan: "day", price: 100, is_on_sale: true },
      { plan: "week", price: 700, is_on_sale: true },
    ]),
    null,
  );
  assert.equal(cheapestPerDayPlan([KM[0]]), null);
});

test("vente ouverte = tarif en vente ET mobile money activé", () => {
  assert.equal(isPassSaleOpen(KM, true), true);
  assert.equal(isPassSaleOpen(KM, false), false); // espèces seules : fermé
  assert.equal(isPassSaleOpen(KM.map((p) => ({ ...p, is_on_sale: false })), true), false);
  assert.equal(isPassSaleOpen([], true), false);
});

test("référence RVP-XXXXXX conforme au contrôle SQL, sans 0/O/1/I", () => {
  for (let i = 0; i < 500; i++) {
    const ref = generatePassReference();
    assert.match(ref, PASS_REFERENCE_PATTERN);
    assert.doesNotMatch(ref.slice(4), /[01OI]/);
  }
  // Octets imposés : symboles attendus, modulo 32.
  const fixed = generatePassReference(() => new Uint8Array([0, 1, 31, 32, 255, 8]));
  const a = PASS_REFERENCE_ALPHABET;
  assert.equal(fixed, `RVP-${a[0]}${a[1]}${a[31]}${a[0]}${a[31]}${a[8]}`);
});

test("messages d'erreur : jamais de code brut, repli générique", () => {
  for (const code of ["not_on_sale", "too_many_pending", "no_market", "reference_taken", "bad_method"]) {
    const msg = passRequestMessage(code);
    assert.ok(msg.length > 20 && !msg.includes("_"), code);
  }
  assert.match(passRequestMessage("???"), /n’a pas pu être enregistrée/);
  assert.match(passRequestMessage(null), /n’a pas pu être enregistrée/);
});

const now = new Date("2026-10-12T12:00:00Z");
const pass = (over) => ({
  id: "x",
  plan: "week",
  status: "active",
  price_paid: 1500,
  country_id: "KM",
  payment_method: "mvola_km",
  payment_reference: "RVP-ABCDEF",
  payment_proof_path: null,
  starts_at: "2026-10-10T12:00:00Z",
  expires_at: "2026-10-17T12:00:00Z",
  created_at: "2026-10-10T11:00:00Z",
  ...over,
});

test("accès : l'échéance la plus lointaine des pass actifs non échus", () => {
  assert.equal(accessUntil([], now), null);
  assert.equal(
    accessUntil(
      [
        pass({ id: "a" }),
        pass({ id: "b", starts_at: "2026-10-17T12:00:00Z", expires_at: "2026-11-16T12:00:00Z" }),
        pass({ id: "c", status: "pending", expires_at: null }),
        pass({ id: "d", expires_at: "2026-10-11T12:00:00Z" }), // échu, pas encore expiré par la tâche
      ],
      now,
    )?.toISOString(),
    "2026-11-16T12:00:00.000Z",
  );
});

test("statuts lisibles", () => {
  assert.deepEqual(passStatus(pass({ status: "pending" }), now), {
    label: "En attente de vérification",
    tone: "pending",
  });
  assert.equal(passStatus(pass({}), now).label, "Actif");
  assert.equal(
    passStatus(pass({ starts_at: "2026-10-17T12:00:00Z", expires_at: "2026-11-16T12:00:00Z" }), now).label,
    "Validé — commence à la fin du pass en cours",
  );
  assert.equal(passStatus(pass({ expires_at: "2026-10-11T00:00:00Z" }), now).tone, "ended");
  assert.equal(passStatus(pass({ status: "expired" }), now).label, "Terminé");
  assert.deepEqual(passStatus(pass({ status: "rejected" }), now), { label: "Non validé", tone: "refused" });
  assert.equal(passStatus(pass({ status: "cancelled" }), now).label, "Annulé");
});

test("motifs de refus : lus en metadata des notifications, le plus récent l'emporte (audit I2)", () => {
  const reasons = rejectReasons([
    { metadata: { step: "rejected", play_pass_id: "p1", reason: "  Aucun paiement reçu  " } },
    { metadata: { step: "rejected", play_pass_id: "p1", reason: "Ancien motif" } },
    { metadata: { step: "activated", play_pass_id: "p2", expires_at: "2026-11-01" } },
    { metadata: { step: "rejected", play_pass_id: "p3", reason: "   " } },
    { metadata: { step: "rejected", play_pass_id: "p4" } },
    { metadata: null },
    {},
  ]);
  assert.deepEqual(reasons, { p1: "Aucun paiement reçu" });
});
