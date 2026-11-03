// Un solde par marché (audit des paramètres, D-05, 2026-11-03).
// node --test features/wallet/wallet-markets.test.mjs  (npm run check:wallet)
// DOIT rester identique à l'app : rivendy_app/lib/features/checkout/services/wallet_markets.dart
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableFor, dialCode, isCreditType, marketPhone, payoutNotes, pendingByMarket,
  splitWalletLines, toWalletLines, withdrawalProblem,
} from "./wallet-markets.ts";
import { phoneHint, validatePhone } from "../../lib/utils/phone-validator.ts";

const rules = { phoneHint, validatePhone };
const names = { KM: "Comores", DJ: "Djibouti", SN: "Sénégal" };
const nameOf = (id) => names[id] ?? id;
const lines = toWalletLines([
  { id: "w-dj", country_id: "DJ", currency: "FDJ", balance: "3000" },
  { id: "w-km", country_id: "KM", currency: "KMF", balance: 12000 },
  { id: "w-sn", country_id: "SN", currency: "XOF", balance: null },
]);

test("la ligne du pays du compte est la carte principale, les autres par nom", () => {
  const { main, others } = splitWalletLines(lines, "KM", nameOf);
  assert.equal(main.id, "w-km");
  assert.deepEqual(others.map((l) => l.country_id), ["DJ", "SN"]);
});

test("sans ligne dans le pays du compte : la première par nom devient principale", () => {
  const { main, others } = splitWalletLines(lines.filter((l) => l.country_id !== "KM"), "KM", nameOf);
  assert.equal(main.country_id, "DJ");
  assert.deepEqual(others.map((l) => l.country_id), ["SN"]);
});

test("aucun portefeuille : rien à afficher", () => {
  assert.deepEqual(splitWalletLines([], "KM", nameOf), { main: null, others: [] });
});

test("montants lus en nombre, null → 0", () => {
  assert.equal(lines[0].balance, 3000);
  assert.equal(lines[2].balance, 0);
});

test("les retraits en cours se comptent par marché, jamais tous ensemble", () => {
  const pending = pendingByMarket([
    { amount: 2500, country_id: "DJ" }, { amount: "500", country_id: "DJ" }, { amount: 5000, country_id: "KM" },
  ]);
  assert.equal(availableFor(lines[0], pending), 0);
  assert.equal(availableFor(lines[1], pending), 7000);
  assert.equal(availableFor(lines[2], pending), 0);
});

test("le signe vient du type : un retrait est un débit même si le montant est positif", () => {
  assert.equal(isCreditType("order_credit"), true);
  assert.equal(isCreditType("refund_credit"), true);
  assert.equal(isCreditType("payout"), false);
  assert.equal(isCreditType("commission_debit"), false);
});

test("contrôle du montant : minimum du marché, disponible, nombre positif", () => {
  assert.equal(withdrawalProblem(1500, 3000, 2000), "below_minimum");
  assert.equal(withdrawalProblem(3500, 3000, 2000), "exceeds_available");
  assert.equal(withdrawalProblem(0, 3000, 2000), "amount_invalid");
  assert.equal(withdrawalProblem(Number.NaN, 3000, 2000), "amount_invalid");
  assert.equal(withdrawalProblem(3000, 3000, 2000), null);
});

test("indicatif du marché", () => {
  assert.equal(dialCode("DJ", rules), "+253");
  assert.equal(dialCode("KM", rules), "+269");
  assert.equal(dialCode(null, rules), null);
});

test("numéro Mobile Money : local, avec indicatif, ou refusé s'il est d'un autre pays", () => {
  assert.deepEqual(marketPhone("77 12 34 56", "DJ", "Djibouti", rules), { phone: "+25377123456" });
  assert.deepEqual(marketPhone("+253 77 12 34 56", "DJ", "Djibouti", rules), { phone: "+25377123456" });
  assert.deepEqual(marketPhone("0025377123456", "DJ", "Djibouti", rules), { phone: "+25377123456" });
  assert.match(marketPhone("+269 321 45 67", "DJ", "Djibouti", rules).error, /\+253/);
  assert.match(marketPhone("", "DJ", "Djibouti", rules).error, /Djibouti/);
  assert.ok("error" in marketPhone("12 34", "DJ", "Djibouti", rules));
});

test("note de la demande : opérateur ou agence, bénéficiaire, canal", () => {
  assert.equal(
    payoutNotes({ method: "mobile_money", operator: "Waafi", beneficiary: " Ali ", channel: "Demande web" }),
    "Opérateur : Waafi · Bénéficiaire : Ali · Demande web");
  assert.equal(
    payoutNotes({ method: "cash", agency: "Agence Rivendy Djibouti", beneficiary: "Ali", channel: "Demande web" }),
    "Agence : Agence Rivendy Djibouti · Retrait par : Ali · Demande web");
  assert.ok(payoutNotes({ method: "cash", beneficiary: "x".repeat(500), channel: "Demande web" }).length <= 300);
});
