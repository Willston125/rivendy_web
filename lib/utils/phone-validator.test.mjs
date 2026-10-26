// Règle de connexion rétrocompatible (audit 21, APPSOCLE-1).
// node --test lib/utils/phone-validator.test.mjs   (npm run check:phone)
// DOIT rester identique à l'app : rivendy_app/.../phone_validator.dart
import { test } from "node:test";
import assert from "node:assert/strict";
import { loginDigitCandidates } from "./phone-validator.ts";

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
