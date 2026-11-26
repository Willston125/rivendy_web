// Règle de connexion rétrocompatible (audit 21, APPSOCLE-1).
// node --test lib/utils/phone-validator.test.mjs   (npm run check:phone)
// DOIT rester identique à l'app : rivendy_app/.../phone_validator.dart
import { test } from "node:test";
import assert from "node:assert/strict";
import { loginDigitCandidates, phoneChangeMovesLogin, phoneDigitsOf, phoneChangeMessage } from "./phone-validator.ts";

// Audit 22 (COMPTES-2) — changement de numéro : même règle que l'app
// (phone_login.dart : phoneDigitsOf, phoneChangeMovesLogin, phoneChangeMessage).
test("changement de numéro : autres chiffres → le numéro de connexion change", () => {
  assert.equal(phoneChangeMovesLogin("25377123456", "+253 77 99 99 99"), true);
});

test("changement de numéro : simple présentation → le profil suffit", () => {
  assert.equal(phoneChangeMovesLogin("25377123456", "+253 77 12 34 56"), false);
  assert.equal(phoneChangeMovesLogin("25377123456", "253 77 12 34 56"), false);
});

test("changement de numéro : compte sans numéro de connexion → le profil suffit", () => {
  assert.equal(phoneChangeMovesLogin(null, "+253 77 99 99 99"), false);
  assert.equal(phoneChangeMovesLogin("", "+253 77 99 99 99"), false);
});

test("phoneDigitsOf : 8 à 15 chiffres, caractères de présentation seulement (comme change-phone)", () => {
  assert.equal(phoneDigitsOf("+269 321 45 67"), "2693214567");
  assert.equal(phoneDigitsOf("321 45 67"), null);       // 7 chiffres : pas un numéro de connexion
  assert.equal(phoneDigitsOf("77-12-34-56"), "77123456");
  assert.equal(phoneDigitsOf("77 12 34 5a"), null);
  assert.equal(phoneDigitsOf("1".repeat(16)), null);
});

test("motifs de change-phone traduits, inconnus compris", () => {
  assert.match(phoneChangeMessage("wrong_password"), /Mot de passe incorrect/);
  assert.match(phoneChangeMessage("phone_taken"), /autre compte/);
  assert.match(phoneChangeMessage("rate_limited"), /une heure/);
  assert.match(phoneChangeMessage("inconnu"), /n’a pas pu être changé/);
});

test("brut d'abord (connexion habituelle inchangée)", () => {
  assert.equal(loginDigitCandidates("+269 321 45 67")[0], "2693214567");
  assert.equal(loginDigitCandidates("321 45 67")[0], "3214567");
});

test("international KM → rattrape la forme locale", () => {
  const c = loginDigitCandidates("+269 321 45 67");
  assert.ok(c.includes("2693214567"));
  assert.ok(c.includes("3214567"));
});

test("local seul → pas d'indicatif inventé", () => {
  assert.deepEqual(loginDigitCandidates("321 45 67"), ["3214567"]);
});

test("préfixe 00 → forme E.164 sans le 00", () => {
  const c = loginDigitCandidates("00269 321 45 67");
  assert.ok(c.includes("2693214567"));
});

test("DJ international → locale 8 chiffres", () => {
  const c = loginDigitCandidates("+253 77 12 34 56");
  assert.ok(c.includes("25377123456"));
  assert.ok(c.includes("77123456"));
});

test("dédoublonnage + plafond à 4", () => {
  const c = loginDigitCandidates("+2693214567");
  assert.ok(c.length <= 4);
  assert.equal(new Set(c).size, c.length);
});

test("trop court → aucune forme invalide", () => {
  assert.deepEqual(loginDigitCandidates("123"), []);
});
