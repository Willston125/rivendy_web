// Rivendy Pass — règles pures (formules simplifiées, lot 3, 2026-11-17).
// node --test features/play/pass-logic.test.mjs  (npm run check:pass)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessLevel, episodeState, filmState, passPriceFor, pendingFor, seasonOffer, showSeasonCard,
  unlockErrorMessage, unlockStatusLabel, unlockTargetLabel,
} from "./pass-logic.ts";

const T = "t-film";
const S = "t-serie";
const lockedFilm = {
  success: true, access: "locked", unlockable: true, plus_active: false, market: "KM", currency: "KMF",
  in_territory: true, title: { price: 200, unlocked: false },
};
const pending = (over) => ({
  id: "u1", unit: "title", title_id: T, status: "pending", reference: "RVD-7KQ2MP", price: 200,
  country_id: "KM", declared_at: null, created_at: "2026-11-17T08:00:00Z", ...over,
});

test("film : les neuf états, dans l'ordre du serveur", () => {
  assert.equal(filmState({ success: true, access: "free" }, [], T), "free");
  assert.equal(filmState({ ...lockedFilm, plus_active: true }, [], T), "plus");
  assert.equal(filmState({ success: true, access: "plus", plus_active: false }, [], T), "plus_only");
  assert.equal(filmState({ ...lockedFilm, title: { price: 200, unlocked: true } }, [], T), "unlocked");
  assert.equal(filmState(lockedFilm, [pending()], T), "to_pay");
  assert.equal(filmState(lockedFilm, [pending({ declared_at: "2026-11-17T09:00:00Z" })], T), "declared");
  assert.equal(filmState({ ...lockedFilm, in_territory: false, unlockable: false }, [], T), "not_in_territory");
  assert.equal(filmState(lockedFilm, [], T), "locked");
  assert.equal(filmState({ ...lockedFilm, title: { price: null, unlocked: false }, unlockable: false }, [], T), "not_for_sale");
});

test("film : une demande pour un autre titre ne compte pas", () => {
  assert.equal(filmState(lockedFilm, [pending({ title_id: "autre" })], T), "locked");
  assert.equal(filmState(lockedFilm, [pending({ status: "active" })], T), "locked");
});

const serie = {
  success: true, access: "locked", unlockable: true, plus_active: false, market: "KM", currency: "KMF",
  in_territory: true, episode_price: 200,
  seasons: [{ season: 1, episodes: 4, price: 500, unlocked: false }, { season: 2, episodes: 2, price: null, unlocked: false }],
  episodes: [
    { episode_id: "e1", season: 1, number: 1, free: true, unlocked: false, price: null },
    { episode_id: "e2", season: 1, number: 2, free: false, unlocked: true, price: 200 },
    { episode_id: "e3", season: 1, number: 3, free: false, unlocked: false, price: 200 },
    { episode_id: "e4", season: 1, number: 4, free: false, unlocked: false, price: 200 },
    { episode_id: "e5", season: 2, number: 1, free: true, unlocked: false, price: null },
    { episode_id: "e6", season: 2, number: 2, free: false, unlocked: false, price: 200 },
  ],
};
const ep = (id) => serie.episodes.find((e) => e.episode_id === id);

test("série : épisode offert, débloqué, à débloquer, demande d'épisode ou de saison", () => {
  assert.equal(episodeState(ep("e1"), serie, [], S), "free");
  assert.equal(episodeState(ep("e2"), serie, [], S), "unlocked");
  assert.equal(episodeState(ep("e3"), serie, [], S), "locked");
  const epReq = pending({ unit: "episode", title_id: S, episode_id: "e3" });
  assert.equal(episodeState(ep("e3"), serie, [epReq], S), "to_pay");
  assert.equal(episodeState(ep("e4"), serie, [epReq], S), "locked");
  const seasonReq = pending({ unit: "season", title_id: S, season: 1, declared_at: "2026-11-17T09:00:00Z" });
  assert.equal(episodeState(ep("e4"), serie, [seasonReq], S), "declared");
  assert.equal(episodeState(ep("e6"), serie, [seasonReq], S), "locked");
  assert.equal(episodeState(ep("e3"), { ...serie, plus_active: true }, [], S), "plus");
  assert.equal(episodeState(ep("e3"), { ...serie, access: "free" }, [], S), "free");
});

test("saison : prix, repère « au lieu de », carte seulement si elle sert", () => {
  const s1 = seasonOffer(1, serie, [], S);
  assert.deepEqual(s1, { season: 1, price: 500, state: "locked", regularTotal: 600, paidEpisodes: 3 });
  assert.equal(showSeasonCard(s1), true);
  const s2 = seasonOffer(2, serie, [], S);
  assert.equal(s2.state, "not_for_sale");
  assert.equal(showSeasonCard(s2), false);
  const req = pending({ unit: "season", title_id: S, season: 1 });
  assert.equal(seasonOffer(1, serie, [req], S).state, "to_pay");
  const allUnlocked = { ...serie, episodes: serie.episodes.map((e) => ({ ...e, unlocked: !e.free })) };
  assert.equal(seasonOffer(1, allUnlocked, [], S).state, "unlocked");
  assert.equal(showSeasonCard(seasonOffer(1, allUnlocked, [], S)), false);
  assert.equal(seasonOffer(3, serie, [], S), null);
});

test("demande en cours : même cible que le serveur", () => {
  const list = [
    pending({ unit: "episode", title_id: S, episode_id: "e3" }),
    pending({ unit: "season", title_id: S, season: 2 }),
  ];
  assert.equal(pendingFor(list, S, "episode", { episodeId: "e3" })?.episode_id, "e3");
  assert.equal(pendingFor(list, S, "episode", { episodeId: "e4" }), undefined);
  assert.equal(pendingFor(list, S, "season", { season: 2 })?.season, 2);
  assert.equal(pendingFor(list, S, "title"), undefined);
});

test("niveaux du catalogue : libre, Pass, Rivendy+", () => {
  assert.equal(accessLevel({ is_premium: false, pass_unlockable: true }), "free");
  assert.equal(accessLevel({ is_premium: true, pass_unlockable: true }), "pass");
  assert.equal(accessLevel({ is_premium: true, pass_unlockable: false }), "plus");
  assert.equal(accessLevel({ is_premium: true }), "plus");
});

test("prix du Pass pour un visiteur : celui de son pays, en vente", () => {
  const rows = [
    { country_id: "KM", unit: "title", price: 200, is_on_sale: true },
    { country_id: "KM", unit: "episode", price: "200", is_on_sale: true },
    { country_id: "DJ", unit: "title", price: 100, is_on_sale: false },
  ];
  assert.equal(passPriceFor(rows, "KM", "title"), 200);
  assert.equal(passPriceFor(rows, "KM", "episode"), 200);
  assert.equal(passPriceFor(rows, "DJ", "title"), null);
  assert.equal(passPriceFor(rows, null, "title"), null);
});

test("libellés et messages", () => {
  assert.equal(unlockTargetLabel({ unit: "title", title: "Ngoma ya Hairi" }), "« Ngoma ya Hairi »");
  assert.equal(unlockTargetLabel({ unit: "season", title: "Les Voisins", season: 1 }), "Saison 1 de « Les Voisins »");
  assert.equal(unlockTargetLabel({ unit: "episode", title: "Les Voisins", episodeNumber: 3 }), "Épisode 3 de « Les Voisins »");
  assert.equal(unlockStatusLabel({ status: "active" }), "Débloqué");
  assert.equal(unlockStatusLabel({ status: "pending", declared_at: null }), "À payer");
  for (const c of ["not_authenticated", "not_unlockable", "no_market", "not_in_territory", "sale_closed", "not_on_sale",
    "already_unlocked", "free_episode", "channel_unavailable", "too_many_pending", "not_found"]) {
    const m = unlockErrorMessage(c);
    assert.notEqual(m, unlockErrorMessage("???"), c);
    assert.ok(!/\b(tu|ton|ta|tes)\b/i.test(m), c);
  }
});
