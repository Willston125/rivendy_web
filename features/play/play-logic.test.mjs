// Rivendy Play sur le site — règles pures (Omnicanal lot C, 2026-10-22).
// node --test features/play/play-logic.test.mjs  (npm run check:playweb)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kindOf, kindLabel, titlePath, isListable, inTerritory, ageLabel, durationLabel, titleMeta, isFinished, resumeAt,
  currentEpisode, nextEpisode, showSkipIntro, upNextAt, publicManifest, streamThumbnail, parseRenditions,
  pickRendition, withBandwidthHint, playbackErrorMessage, isDocumentary, cover, wideImage, hasTrailer, isArtistClip,
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
