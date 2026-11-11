// Radios en direct sur le site (2026-11-11).
//   node --test features/music/radio/radio-logic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupRadiosByRegion, parseRadioStation, parseRadioStations, radioInitials, radioListenSeconds, radioPlayableHere,
  radioRetryDelay,
} from "./radio-logic.ts";

const row = (o = {}) => ({
  id: "r1", name: "Radio Océan Indien", place: null, region: "comores",
  stream_url: "https://stream.vestaradio.com/RadioMRV", stream_format: "mp3", homepage_url: null, logo_url: null, ...o,
});

test("une radio du serveur est lue telle quelle", () => {
  const s = parseRadioStation(row({ place: " Moroni ", logo_url: "https://cdn.test/l.png" }));
  assert.equal(s.place, "Moroni");
  assert.equal(s.logo_url, "https://cdn.test/l.png");
  assert.equal(s.status, undefined);
});

test("jamais un flux non https : la radio est écartée", () => {
  assert.equal(parseRadioStation(row({ stream_url: "http://domoni-inter.org:8000/live" })), null);
  assert.deepEqual(parseRadioStations([row(), row({ id: "r2", stream_url: "http://x.test" })]).map((s) => s.id), ["r1"]);
});

test("réponse vide ou bancale : aucune radio, pas d'erreur", () => {
  assert.deepEqual(parseRadioStations(null), []);
  assert.deepEqual(parseRadioStations({}), []);
  assert.equal(parseRadioStation("x"), null);
});

test("logo non https retiré, rubrique et format inconnus remis à défaut", () => {
  const s = parseRadioStation(row({ logo_url: "http://x.test/l.png", region: "afrique", stream_format: "ogg" }));
  assert.equal(s.logo_url, null);
  assert.equal(s.region, "monde");
  assert.equal(s.stream_format, "mp3");
});

test("aperçu : l'état est gardé", () => {
  assert.equal(parseRadioStation(row({ status: "preview" })).status, "preview");
});

test("rubriques dans l'ordre Comores, Océan Indien, Monde, sans rubrique vide", () => {
  const g = groupRadiosByRegion(parseRadioStations([
    row({ id: "a", region: "monde", name: "RFI Afrique" }),
    row({ id: "b", region: "comores" }),
  ]));
  assert.deepEqual(g.map((x) => [x.label, x.stations.map((s) => s.id)]), [["Comores", ["b"]], ["Monde", ["a"]]]);
});

test("coupure : trois nouveaux essais (2 s, 5 s, 10 s), puis on s'arrête", () => {
  assert.deepEqual([1, 2, 3, 4].map(radioRetryDelay), [2000, 5000, 10000, null]);
});

test("HLS seulement si le navigateur le lit", () => {
  assert.equal(radioPlayableHere("mp3", false), true);
  assert.equal(radioPlayableHere("hls", false), false);
  assert.equal(radioPlayableHere("hls", true), true);
});

test("secondes déclarées : 0 à 120", () => {
  assert.equal(radioListenSeconds(61_400), 61);
  assert.equal(radioListenSeconds(600_000), 120);
  assert.equal(radioListenSeconds(-5), 0);
  assert.equal(radioListenSeconds(Number.NaN), 0);
});

test("initiales d'une radio sans logo", () => {
  assert.equal(radioInitials("Radio Océan Indien"), "ROI");
  assert.equal(radioInitials("RTMC"), "RTMC");
  assert.equal(radioInitials("Midayi FM"), "MF");
});
