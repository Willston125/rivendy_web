// Rivendy+ — règles pures (Omnicanal lot B, 2026-10-21).
// node --test features/plus/plus-logic.test.mjs  (npm run check:plus)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  offerBenefits, benefitGroups, compareRows, daysLabel, durationLabel, isValidPayerPhone, isValidOperatorReference,
  requestErrorMessage, declareErrorMessage, periodStatus, requestValidUntil, rejectReasons,
  EXCLUSIVE_CONTENT_LIVE, EARLY_ACCESS_LIVE,
} from "./plus-logic.ts";

// Formules du 15/11 (lot 1), telles que les rend rivendy_offer_entitlements_resolved.
const KMF = (n) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} KMF`;
const MONTH_KM = {
  certified_badge: true, boosts_per_cycle: 5, boost_days: 3, story_max_hours: 72, store_cover_video: true,
  videos_unlimited: true, videos_per_day: 0, videos_online_max: 120, video_max_seconds: 30,
  delivery_credits_per_cycle: 2, delivery_credit_full_until: 500, delivery_credit_partial_percent: 50,
  delivery_half_threshold: 25000, delivery_half_percent: 50, delivery_full_threshold: 35000,
  play_premium: true, music_premium: true, simultaneous_streams: 2, exclusive_content: true, early_access: true,
};
const FREE_KM = {
  certified_badge: false, boosts_per_cycle: 0, boost_days: 3, story_max_hours: 24, store_cover_video: false,
  videos_unlimited: false, videos_per_day: 3, videos_online_max: 60, video_max_seconds: 15,
  delivery_credits_per_cycle: 0, delivery_half_threshold: 25000, delivery_half_percent: 50, delivery_full_threshold: 0,
  play_premium: false, music_premium: false,
};
const strip = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("delivery_")));
const MONTH_DJ = strip(MONTH_KM);
const FREE_DJ = strip(FREE_KM);

test("avantages rangés par usage : vendre, acheter, regarder (Comores)", () => {
  const g = benefitGroups(MONTH_KM, KMF);
  assert.deepEqual(g.sell, [
    "Compte certifié : le badge sur votre boutique et vos articles",
    "5 boosts de 3 jours par mois",
    "Stories de 24 h ou de 72 h, au choix",
    "Publications avec vidéo sans limite, vidéos de 30 s",
    "Bannière vidéo en haut de votre boutique",
  ]);
  assert.deepEqual(g.buy, [
    "2 livraisons offertes par mois, quel que soit le montant",
    "Livraison offerte dès 35 000 KMF d’articles",
    "Rivendy choisit tout seul la réduction la plus forte, sans case à cocher",
  ]);
  assert.ok(g.watch.includes("Tout Rivendy Play, sans publicité"));
  assert.ok(g.watch.includes("Toute la Musique Premium, sans publicité"));
  assert.ok(g.watch.includes("2 écrans en même temps"));
  assert.equal(g.watch.at(-1), "Sur le site et dans l’application, avec le même compte");
});

test("Djibouti : aucun avantage de livraison promis", () => {
  const g = benefitGroups(MONTH_DJ, KMF);
  assert.deepEqual(g.buy, []);
  assert.equal(g.sell.length, 5);
  const rows = compareRows(FREE_DJ, MONTH_DJ, KMF);
  assert.ok(!rows.some((r) => r.label.includes("ivraison")));
});

test("droit à zéro ou faux : jamais promis", () => {
  const g = benefitGroups({ boosts_per_cycle: 0, story_max_hours: 24, videos_unlimited: false, play_premium: true }, KMF);
  assert.deepEqual(g.sell, []);
  assert.deepEqual(g.buy, []);
  assert.ok(!g.watch.some((b) => b.includes("Musique")));
  assert.equal(daysLabel(1), "1 jour");
});

test("tableau Gratuit / Rivendy+ : valeurs du serveur, livraison aux Comores", () => {
  const rows = compareRows(FREE_KM, MONTH_KM, KMF);
  const row = (label) => rows.find((r) => r.label === label);
  assert.deepEqual(row("Badge compte certifié"), { label: "Badge compte certifié", free: "—", plus: "Oui" });
  assert.deepEqual(row("Boosts d’articles (3 jours)"), { label: "Boosts d’articles (3 jours)", free: "Aucun", plus: "5 par mois" });
  assert.equal(row("Story d’un article").plus, "24 h ou 72 h");
  assert.equal(row("Publications avec vidéo").free, "3 par jour");
  assert.equal(row("Publications avec vidéo").plus, "Sans limite");
  assert.equal(row("Durée d’une vidéo d’article").free, "15 s");
  assert.equal(row("Livraisons offertes").plus, "2 par mois");
  assert.equal(row("Selon le montant de la commande").free, "Livraison à moitié prix dès 25 000 KMF");
  assert.equal(row("Selon le montant de la commande").plus, "Livraison à moitié prix dès 25 000 KMF, offerte dès 35 000 KMF");
  assert.equal(row("Rivendy Musique").free, "Avec publicités");
});

const NOW = new Date("2026-10-28T15:00:00Z");
const base = {
  id: "p1", plan: "month", price_paid: 2000, country_id: "KM", payment_method: "MVola",
  payment_reference: "RVP-7K2M9Q", payment_channel: "mvola", declared_at: null, agency_id: null,
  starts_at: null, expires_at: null, created_at: "2026-10-28T10:00:00Z",
};

test("avantages à plat : lus dans les droits de la formule, jamais supposés", () => {
  const plus = offerBenefits({ entitlements: { play_premium: true, music_premium: true, exclusive_content: true,
    early_access: true, simultaneous_streams: 2 } });
  assert.ok(plus.includes("Tout Rivendy Play, sans publicité"));
  assert.ok(plus.includes("2 écrans en même temps"));
  const day = offerBenefits({ entitlements: { play_premium: true, simultaneous_streams: 1 } });
  assert.ok(!day.some((b) => b.includes("écrans")));
  assert.ok(!day.includes("Contenus exclusifs"));
});

test("contenus exclusifs et avant-premières : jamais promis avant d'exister", () => {
  assert.equal(EXCLUSIVE_CONTENT_LIVE, false);
  assert.equal(EARLY_ACCESS_LIVE, false);
  const b = offerBenefits({ entitlements: { play_premium: true, exclusive_content: true, early_access: true } });
  assert.ok(!b.includes("Contenus exclusifs"));
  assert.ok(!b.includes("Avant-premières"));
  assert.ok(b.includes("Tout Rivendy Play, sans publicité"));
});

test("livraisons offertes : promises dès qu'elles existent dans les droits (lot 1 en production)", () => {
  const b = offerBenefits({ entitlements: { delivery_credits_per_cycle: 2 } }, KMF);
  assert.ok(b.includes("2 livraisons offertes par mois, quel que soit le montant"));
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
