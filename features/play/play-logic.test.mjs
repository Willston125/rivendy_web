// Rivendy Play sur le site — règles pures (Omnicanal lot C, 2026-10-22).
// node --test features/play/play-logic.test.mjs  (npm run check:playweb)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kindOf, kindLabel, titlePath, isListable, inTerritory, ageLabel, durationLabel, titleMeta, isFinished, resumeAt,
  currentEpisode, nextEpisode, showSkipIntro, upNextAt, publicManifest, streamThumbnail, parseRenditions,
  pickRendition, withBandwidthHint, playbackErrorMessage, isDocumentary, cover, wideImage, hasTrailer, isArtistClip,
  playImage, playSrcSet, landscapeArt, posterArt, heroTitles, heroKicker, metaParts, watchHref, resumeHref,
  resumeEntries, remainingLabel, countLabel, homeRows, SMALL_CATALOG, foldText, searchTitles, genresOf,
  parsePendingListAdd, PENDING_TTL_MS, isRecent,
} from "./play-logic.ts";

const ep = (id, season, n, extra = {}) => ({ id, title_id: "s", season, episode_number: n, title: id, video_status: "ready", ...extra });

test("types, adresses et images", () => {
  assert.equal(kindOf("inconnu"), "film");
  assert.equal(kindLabel("serie"), "Série");
  assert.equal(titlePath({ id: "a", kind: "film" }), "/play/movie/a");
  assert.equal(titlePath({ id: "a", kind: "serie" }), "/play/series/a");
  assert.equal(titlePath({ id: "a", kind: "clip" }), "/play/clip/a");
  assert.equal(titlePath({ id: "a", kind: "short" }), "/play/short/rivendy/a");
  assert.equal(cover({ poster_url: null, backdrop_url: "b", thumbnail_url: "t" }), "b");
  assert.equal(wideImage({ poster_url: "p", backdrop_url: null, thumbnail_url: "t" }), "p");
  assert.ok(hasTrailer({ trailer_uid: "u", trailer_status: "ready" }));
  assert.ok(!hasTrailer({ trailer_uid: "u", trailer_status: "processing" }));
  assert.ok(isArtistClip({ kind: "clip", artist_id: "x" }));
  assert.ok(!isArtistClip({ kind: "clip", artist_id: null }));
});

test("rangées : films et clips prêts, séries toujours, jamais les Shorts", () => {
  assert.ok(isListable({ kind: "film", video_status: "ready" }));
  assert.ok(!isListable({ kind: "film", video_status: "processing" }));
  assert.ok(isListable({ kind: "serie", video_status: null }));
  assert.ok(!isListable({ kind: "short", video_status: "ready" }));
});

test("territoire et libellés", () => {
  assert.ok(inTerritory([], "KM"));
  assert.ok(inTerritory([{ country_id: "KM" }], "KM"));
  assert.ok(!inTerritory([{ country_id: "DJ" }], "KM"));
  assert.ok(!inTerritory([{ country_id: "DJ" }], null));
  assert.equal(ageLabel("12"), "-12");
  assert.equal(ageLabel("tous"), "Tout public");
  assert.equal(durationLabel(6720), "1 h 52");
  assert.equal(durationLabel(2700), "45 min");
  assert.equal(durationLabel(3600), "1 h");
  assert.equal(titleMeta({ id: "x", kind: "film", title: "", genre: "Drame", release_year: 2026, duration_seconds: 6720 }), "Drame • 2026 • 1 h 52");
  assert.equal(titleMeta({ id: "x", kind: "serie", title: "", genre: "Drame" }, 8), "Série • Drame • 8 épisodes");
});

test("reprise : fini à 95 % ou dans le générique, reprise après 30 s", () => {
  assert.ok(isFinished(95, 100));
  assert.ok(isFinished(5300, 5400));
  assert.ok(!isFinished(4000, 5400));
  assert.ok(!isFinished(10, 0));
  assert.equal(resumeAt(20, 5400), 0);
  assert.equal(resumeAt(1476.7, 5400), 1476);
  assert.equal(resumeAt(5390, 5400), 0);
});

test("série : épisode en cours, ou le suivant s'il est fini, ou le premier", () => {
  const eps = [ep("e3", 1, 3), ep("e1", 1, 1), ep("e2", 1, 2), ep("s2e1", 2, 1)];
  assert.equal(currentEpisode(eps, []).episode.id, "e1");
  const inProgress = [{ title_id: "s", episode_id: "e2", position_seconds: 600, duration_seconds: 2400, updated_at: "2026-10-20T10:00:00Z" }];
  assert.deepEqual([currentEpisode(eps, inProgress).episode.id, currentEpisode(eps, inProgress).at], ["e2", 600]);
  const finished = [{ title_id: "s", episode_id: "e3", position_seconds: 2390, duration_seconds: 2400, updated_at: "2026-10-21T10:00:00Z" }, ...inProgress];
  assert.equal(currentEpisode(eps, finished).episode.id, "s2e1");
  assert.equal(nextEpisode(eps, "e3", () => true).id, "s2e1");
  assert.equal(nextEpisode(eps, "e3", () => false), null);
  assert.equal(nextEpisode(eps, "s2e1", () => true), null);
});

test("lecteur : passer l'intro, épisode suivant", () => {
  assert.ok(showSkipIntro(5, null, 60));
  assert.ok(!showSkipIntro(60, 0, 60));
  assert.ok(!showSkipIntro(5, 10, 60));
  assert.ok(!showSkipIntro(5, null, null));
  assert.equal(upNextAt(5000, 5400), 5000);
  assert.equal(upNextAt(null, 5400), 5390);
});

test("Cloudflare : manifeste public, vignette, Éco data", () => {
  assert.equal(publicManifest("abc"), "https://customer-22iqkw4cwdg7uf5h.cloudflarestream.com/abc/manifest/video.m3u8");
  assert.match(streamThumbnail("abc", 240), /\/abc\/thumbnails\/thumbnail\.jpg\?time=1s&height=240$/);
  const master = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=900000,AVERAGE-BANDWIDTH=800000,RESOLUTION=640x360",
    "a.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480",
    "b.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080",
    "c.m3u8",
  ].join("\n");
  const r = parseRenditions(master);
  assert.deepEqual(r.map((x) => x.height), [360, 480, 1080]);
  assert.equal(pickRendition(r, 360).bandwidth, 900000);
  assert.equal(pickRendition(r, 480).bandwidth, 1500000);
  assert.equal(pickRendition(r, 240).bandwidth, 900000);
  assert.equal(withBandwidthHint("https://h/x/manifest/video.m3u8?a=1", 900000), "https://h/x/manifest/video.m3u8?a=1&clientBandwidthHint=0.9");
});

test("messages et documentaires", () => {
  assert.match(playbackErrorMessage("personal_token_required"), /application/);
  assert.match(playbackErrorMessage("pass_required"), /Rivendy\+/);
  assert.notEqual(playbackErrorMessage("xyz"), playbackErrorMessage("not_found"));
  assert.ok(isDocumentary("Documentaire"));
  assert.ok(isDocumentary("documentary film"));
  assert.ok(!isDocumentary("Drame"));
});

// ── Refonte « salle de cinéma » (2026-10-22) ───────────────────────────────

const NOW = new Date("2026-10-22T12:00:00Z");
const BASE = "https://x.supabase.co/storage/v1/object/public/play-images/";
const t = (id, extra = {}) => ({
  id, kind: "film", title: id, video_status: "ready", poster_url: `${BASE}posters/${id}.jpg`, backdrop_url: null,
  thumbnail_url: null, featured_rank: null, published_at: "2026-10-01T00:00:00Z", genre: null, ...extra,
});

test("images : redimensionnées SANS recadrage, jamais une affiche prise pour un fond", () => {
  assert.equal(playImage(`${BASE}posters/a.jpg`, 480),
    "https://x.supabase.co/storage/v1/render/image/public/play-images/posters/a.jpg?width=480&resize=contain&quality=70");
  assert.equal(playImage("https://customer.cloudflarestream.com/u/thumbnails/thumbnail.jpg", 480), "https://customer.cloudflarestream.com/u/thumbnails/thumbnail.jpg");
  assert.equal(playImage("http://x/a.jpg", 320), null);
  assert.equal(playImage(null, 320), null);
  assert.equal(playSrcSet(`${BASE}a.jpg`, [320, 480]).split(", ").length, 2);
  assert.match(playSrcSet(`${BASE}a.jpg`, [320]), / 320w$/);
  assert.equal(playSrcSet("https://ailleurs.example/a.jpg", [320]), undefined);
  // Film : seul le fond du dashboard est paysage (sa vignette vidéo est signée).
  assert.equal(landscapeArt({ kind: "film", backdrop_url: null, thumbnail_url: "https://cf/x.jpg" }), null);
  assert.equal(landscapeArt({ kind: "film", backdrop_url: `${BASE}b.jpg`, thumbnail_url: null }), `${BASE}b.jpg`);
  assert.equal(landscapeArt({ kind: "clip", backdrop_url: null, thumbnail_url: "https://cf/x.jpg" }), "https://cf/x.jpg");
  assert.equal(posterArt({ poster_url: "http://x/a.jpg" }), null);
});

test("bannière : à la une d'abord, puis les plus récents ; jamais sans image ni clip", () => {
  const list = [
    t("recent", { published_at: "2026-10-20T00:00:00Z" }),
    t("une", { featured_rank: 1, published_at: "2026-01-01T00:00:00Z" }),
    t("sans-image", { poster_url: null }),
    t("clip", { kind: "clip", thumbnail_url: "https://cf/x.jpg" }),
    t("pas-prete", { video_status: "processing" }),
    t("serie", { kind: "serie", video_status: null, published_at: "2026-10-10T00:00:00Z" }),
  ];
  assert.deepEqual(heroTitles(list).map((x) => x.id), ["une", "recent", "serie"]);
  assert.equal(heroTitles(list, 1).length, 1);
  assert.equal(heroKicker(t("a", { featured_rank: 2 }), NOW), "Le film à la une");
  assert.equal(heroKicker(t("a", { kind: "serie", featured_rank: 1 }), NOW), "La série à la une");
  assert.equal(heroKicker(t("a", { published_at: "2026-10-01T00:00:00Z" }), NOW), "Nouveau film");
  assert.equal(heroKicker(t("a", { published_at: "2025-01-01T00:00:00Z" }), NOW), "Film");
  assert.ok(isRecent({ published_at: "2026-09-01T00:00:00Z" }, NOW));
  assert.ok(!isRecent({ published_at: null }, NOW));
});

test("métadonnées : seulement ce qui est renseigné", () => {
  assert.deepEqual(metaParts(t("a", { release_year: 2023, genre: "Action", duration_seconds: 840 })), ["2023", "Film", "Action", "14 min"]);
  assert.deepEqual(metaParts(t("a", { kind: "serie", genre: " Drame ", release_year: 2025 }), 7), ["2025", "Série", "Drame", "7 épisodes"]);
  assert.deepEqual(metaParts(t("a", { kind: "serie" })), ["Série"]);
  assert.deepEqual(metaParts(t("a", { duration_seconds: 0 })), ["Film"]);
});

test("liens de lecture et reprise", () => {
  assert.equal(watchHref({ id: "a", kind: "film" }), "/play/watch/movie/a");
  assert.equal(watchHref({ id: "a", kind: "clip" }), "/play/watch/clip/a");
  assert.equal(watchHref({ id: "a", kind: "serie" }), null);
  assert.equal(resumeHref({ title_id: "s", episode_id: "e" }), "/play/watch/episode/e");
  assert.equal(resumeHref({ title_id: "f", episode_id: null }), "/play/watch/movie/f");
  const p = (title_id, position, duration, updated_at, episode_id = null) => ({ title_id, episode_id, position_seconds: position, duration_seconds: duration, updated_at });
  const rows = resumeEntries([
    p("a", 600, 5400, "2026-10-20T10:00:00Z"),
    p("b", 20, 5400, "2026-10-21T10:00:00Z"),
    p("c", 5390, 5400, "2026-10-21T11:00:00Z"),
    p("s", 300, 2400, "2026-10-22T09:00:00Z", "e2"),
    p("s", 900, 2400, "2026-10-19T09:00:00Z", "e1"),
  ]);
  assert.deepEqual(rows.map((r) => `${r.title_id}${r.episode_id ? `:${r.episode_id}` : ""}`), ["s:e2", "a"]);
  assert.equal(remainingLabel(600, 5400), "Reste 1 h 20");
  assert.equal(remainingLabel(5400, 5400), "Presque fini");
  assert.equal(countLabel(3), "03");
  assert.equal(countLabel(12), "12");
});

test("accueil, petit catalogue : une seule rangée « À l'affiche », sans répétition", () => {
  const list = [
    t("code", { published_at: "2026-10-05T00:00:00Z" }),
    t("boussole", { kind: "serie", video_status: null, published_at: "2026-10-12T00:00:00Z" }),
    t("mbaye", { featured_rank: 1, published_at: "2026-10-08T00:00:00Z" }),
    t("clip", { kind: "clip" }),
  ];
  const rows = homeRows(list, ["code", "boussole", "mbaye"], NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "À l’affiche");
  assert.deepEqual(rows[0].titles.map((x) => x.id), ["mbaye", "code", "boussole"]);
  assert.deepEqual(homeRows([], [], NOW), []);
});

test("accueil, grand catalogue : chaque titre une seule fois, rangées vides absentes", () => {
  const films = Array.from({ length: SMALL_CATALOG + 4 }, (_, i) =>
    t(`f${i}`, { genre: i < 5 ? "Comédie" : "Drame", published_at: `2026-${i < 6 ? "10" : "03"}-${String(10 + i).padStart(2, "0")}T00:00:00Z` }));
  const series = [t("s1", { kind: "serie", video_status: null, published_at: "2026-01-01T00:00:00Z" })];
  const rows = homeRows([...films, ...series], ["f11", "f10", "f9"], NOW);
  const ids = rows.flatMap((r) => r.titles.map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length, "un titre répété");
  assert.equal(rows[0].id, "top");
  assert.equal(rows[0].layout, "ranked");
  assert.ok(rows.some((r) => r.id === "new"));
  assert.ok(rows.every((r) => r.titles.length > 0));
  const filmRow = rows.find((r) => r.id === "film");
  if (filmRow) assert.equal(filmRow.total, films.length);
  assert.equal(rows.find((r) => r.id === "serie").titles[0].id, "s1");
  // Moins de 3 titres « les plus regardés » : pas de rangée classée.
  assert.ok(!homeRows([...films, ...series], ["f1"], NOW).some((r) => r.id === "top"));
});

test("recherche : avec ou sans accents, titre, genre ou artiste", () => {
  const list = [
    t("1", { title: "Mbayé Trambwé", genre: "Action" }),
    t("2", { title: "La Boussole Digitale", kind: "serie", video_status: null, genre: "Drame" }),
    t("3", { title: "Waza", kind: "clip", artist: "Nawal Élodie", genre: "Twarab" }),
    t("4", { title: "Brouillon", video_status: "processing" }),
    t("5", { title: "Cœur des îles" }),
  ];
  assert.deepEqual(searchTitles(list, "mbaye").map((x) => x.id), ["1"]);
  assert.deepEqual(searchTitles(list, "MBAYÉ").map((x) => x.id), ["1"]);
  assert.deepEqual(searchTitles(list, "elodie").map((x) => x.id), ["3"]);
  assert.deepEqual(searchTitles(list, "drame").map((x) => x.id), ["2"]);
  assert.deepEqual(searchTitles(list, "coeur des iles").map((x) => x.id), ["5"]);
  assert.deepEqual(searchTitles(list, "brouillon"), []);
  assert.deepEqual(searchTitles(list, "zzz"), []);
  assert.equal(searchTitles(list, "  ").length, 4);
  assert.equal(foldText("L’Été"), "l'ete");
  assert.deepEqual(genresOf([{ genre: "Drame" }, { genre: "drame" }, { genre: "Action" }, { genre: null }]), ["Action", "Drame"]);
});

test("« Ma liste » demandée sans compte : 30 minutes, un identifiant valide", () => {
  const id = "0b8c2a9e-1f5d-4a1b-9c3e-7d2f4a6b8c0d";
  const at = NOW.getTime();
  assert.deepEqual(parsePendingListAdd(JSON.stringify({ titleId: id.toUpperCase(), label: "Mbayé", at }), at + 1000),
    { titleId: id, label: "Mbayé", at });
  assert.equal(parsePendingListAdd(JSON.stringify({ titleId: id, at }), at + PENDING_TTL_MS + 1), null);
  assert.equal(parsePendingListAdd(JSON.stringify({ titleId: "pas-un-uuid", at }), at), null);
  assert.equal(parsePendingListAdd("{", at), null);
  assert.equal(parsePendingListAdd(null, at), null);
});
