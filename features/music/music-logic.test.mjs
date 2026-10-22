// Rivendy Music sur le site — règles pures (Omnicanal lot D, 2026-10-21).
// node --test features/music/music-logic.test.mjs  (npm run check:music)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artistName, trackSubtitle, isPlayable, availableIn, releaseKindLabel, formatDuration, releaseMeta,
  thumbUrl, hitMovement, countThreshold, addListened, shouldCount, shouldPrefetchNext, grantStillUsable,
  SKIPPABLE_STREAM_ERRORS, streamErrorMessage, nextRepeat, nextIndex, previousAction, shuffleKeepingCurrent,
  isValidPlaylistName, searchable,
} from "./music-logic.ts";

test("nom de l'artiste : compte, puis nom saisi, puis Rivendy", () => {
  assert.equal(artistName({ play_artists: { name: "Nawal" }, artist_name: "X" }), "Nawal");
  assert.equal(artistName({ play_artists: null, artist_name: " Cheikh MC " }), "Cheikh MC");
  assert.equal(artistName({ play_artists: { name: "" }, artist_name: null }), "Rivendy");
  assert.equal(trackSubtitle({ featuring: "Mze" }, { artist_name: "A" }), "A · feat. Mze");
});

test("lecture : seulement un fichier prêt ; marché : aucune restriction = partout", () => {
  assert.ok(isPlayable({ audio_status: "ready" }));
  assert.ok(!isPlayable({ audio_status: "processing" }));
  assert.ok(availableIn({ music_release_countries: [] }, "KM"));
  assert.ok(availableIn({ music_release_countries: [{ country_id: "KM" }] }, "KM"));
  assert.ok(!availableIn({ music_release_countries: [{ country_id: "DJ" }] }, "KM"));
  assert.ok(!availableIn({ music_release_countries: [{ country_id: "DJ" }] }, null));
});

test("libellés et durées", () => {
  assert.equal(releaseKindLabel("ep"), "EP");
  assert.equal(releaseKindLabel("album"), "Album");
  assert.equal(formatDuration(187), "3:07");
  assert.equal(formatDuration(3725), "1:02:05");
  assert.equal(releaseMeta([{ duration_seconds: 1200 }, { duration_seconds: 1260 }]), "2 titres · 41 min");
  assert.equal(releaseMeta([{ duration_seconds: 20 }]), "1 titre");
});

test("vignettes : seulement music-images et play-images, en https", () => {
  const u = "https://x.supabase.co/storage/v1/object/public/music-images/artists/a/1.jpg";
  assert.equal(thumbUrl(u, 320), "https://x.supabase.co/storage/v1/render/image/public/music-images/artists/a/1.jpg?width=320&quality=70");
  const other = "https://x.supabase.co/storage/v1/object/public/products/1.jpg";
  assert.equal(thumbUrl(other, 320), other);
  assert.equal(thumbUrl("http://x/a.jpg", 160), "http://x/a.jpg");
  assert.equal(thumbUrl(null, 160), null);
});

test("Rivendy Hit : mouvement", () => {
  assert.equal(hitMovement(3, null), "Nouveau");
  assert.equal(hitMovement(2, 5), "▲ 3");
  assert.equal(hitMovement(6, 4), "▼ 2");
  assert.equal(hitMovement(1, 1), "=");
});

test("comptage : 30 s d'écoute réelle, pas de saut, jamais un extrait", () => {
  assert.equal(countThreshold(200), 30);
  assert.equal(countThreshold(20), 20);
  assert.equal(countThreshold(null), 30);
  let l = 0;
  l = addListened(l, 0, 1.5);
  l = addListened(l, 1.5, 60);
  assert.equal(l, 1.5);
  l = addListened(l, 60, 59);
  assert.equal(l, 1.5);
  assert.ok(shouldCount({ listened: 30, duration: 200, preview: false, counted: false }));
  assert.ok(!shouldCount({ listened: 29.9, duration: 200, preview: false, counted: false }));
  assert.ok(!shouldCount({ listened: 40, duration: 200, preview: true, counted: false }));
  assert.ok(!shouldCount({ listened: 40, duration: 200, preview: false, counted: true }));
  assert.ok(shouldCount({ listened: 20, duration: 20, preview: false, counted: false }));
});

test("titre suivant demandé à 70 % ou 20 s avant la fin ; lien réutilisable", () => {
  assert.ok(!shouldPrefetchNext(100, 200));
  assert.ok(shouldPrefetchNext(140, 200));
  assert.ok(shouldPrefetchNext(35, 50));
  assert.ok(!shouldPrefetchNext(10, 0));
  const now = 1_000_000;
  assert.ok(grantStillUsable(now - 60_000, now + 5 * 60_000, now));
  assert.ok(!grantStillUsable(now - 11 * 60_000, now + 5 * 60_000, now));
  assert.ok(!grantStillUsable(now - 60_000, now + 60_000, now));
});

test("erreurs de lecture : messages et titres à passer", () => {
  assert.ok(SKIPPABLE_STREAM_ERRORS.has("pass_required"));
  assert.ok(!SKIPPABLE_STREAM_ERRORS.has("too_many_requests"));
  assert.match(streamErrorMessage("pass_required"), /Rivendy\+/);
  assert.notEqual(streamErrorMessage("x"), streamErrorMessage("no_audio"));
});

test("file d'attente : répétition, suivant, précédent, aléatoire", () => {
  assert.equal(nextRepeat("off"), "all");
  assert.equal(nextRepeat("all"), "one");
  assert.equal(nextRepeat("one"), "off");
  assert.equal(nextIndex(0, 3, "off"), 1);
  assert.equal(nextIndex(2, 3, "off"), null);
  assert.equal(nextIndex(2, 3, "all"), 0);
  assert.equal(nextIndex(1, 3, "one"), 1);
  assert.deepEqual(previousAction(2, 10), { restart: true, index: 2 });
  assert.deepEqual(previousAction(2, 1), { restart: false, index: 1 });
  assert.deepEqual(previousAction(0, 1), { restart: true, index: 0 });
  const s = shuffleKeepingCurrent(["a", "b", "c", "d"], 2, () => 0);
  assert.equal(s[0], "c");
  assert.deepEqual([...s].sort(), ["a", "b", "c", "d"]);
});

test("playlist et recherche", () => {
  assert.ok(isValidPlaylistName("Mes sons"));
  assert.ok(!isValidPlaylistName("   "));
  assert.ok(!isValidPlaylistName("x".repeat(61)));
  assert.ok(searchable("ab"));
  assert.ok(!searchable(" a "));
});

// ── Refonte du 2026-10-22 ──────────────────────────────────────────────────
import {
  availableGenres, filterByGenre, distinctArtistIds, uniqueReleases, releaseYear, musicSharePath,
  parsePendingAction, samePath, PENDING_MAX_AGE_MS,
} from "./music-logic.ts";

test("genres : seulement ceux qui ont une sortie, dans l'ordre du dashboard", () => {
  const genres = [
    { id: "rap", name: "Rap", position: 40 },
    { id: "twarab", name: "Twarab", position: 10 },
    { id: "zouk", name: "Zouk", position: 50 },
  ];
  const releases = [{ genre_id: "rap" }, { genre_id: "twarab" }, { genre_id: null }, { genre_id: "rap" }];
  assert.deepEqual(availableGenres(releases, genres).map((g) => g.id), ["twarab", "rap"]);
  assert.deepEqual(availableGenres([], genres), []);
  assert.equal(filterByGenre(releases, "rap").length, 2);
  assert.equal(filterByGenre(releases, null).length, 4);
});

test("artistes et sorties sans doublon, année", () => {
  assert.deepEqual(distinctArtistIds([{ artist_id: "a" }, { artist_id: null }, { artist_id: "b" }, { artist_id: "a" }]), ["a", "b"]);
  assert.deepEqual(uniqueReleases([[{ id: "1" }, { id: "2" }], [{ id: "2" }, { id: "3" }]]).map((r) => r.id), ["1", "2", "3"]);
  assert.equal(releaseYear({ release_date: "2026-05-01", published_at: "2025-01-01" }), "2026");
  assert.equal(releaseYear({ release_date: null, published_at: "2025-01-01T10:00:00Z" }), "2025");
  assert.equal(releaseYear({ release_date: null, published_at: null }), "");
});

test("liens partagés", () => {
  assert.equal(musicSharePath("track", "t1"), "/music/track/t1");
  assert.equal(musicSharePath("release", "r1"), "/music/album/r1");
  assert.equal(musicSharePath("artist", "a1"), "/artist/a1");
  assert.equal(musicSharePath("playlist", "p1"), "/music/playlist/p1");
});

test("action en attente de connexion : valide, récente, chemin interne", () => {
  const now = 1_000_000_000;
  const ok = JSON.stringify({ kind: "like", id: "t1", path: "/music/album/r1", label: "Bahari", at: now - 1000 });
  assert.deepEqual(parsePendingAction(ok, now), { kind: "like", id: "t1", path: "/music/album/r1", label: "Bahari", at: now - 1000 });
  const old = JSON.stringify({ kind: "like", id: "t1", path: "/music", label: "", at: now - PENDING_MAX_AGE_MS - 1 });
  assert.equal(parsePendingAction(old, now), null);
  assert.equal(parsePendingAction(JSON.stringify({ kind: "pay", id: "t1", path: "/music", at: now }), now), null);
  assert.equal(parsePendingAction(JSON.stringify({ kind: "like", id: "t1", path: "https://x.com", at: now }), now), null);
  assert.equal(parsePendingAction(JSON.stringify({ kind: "like", id: "t1", path: "//x.com", at: now }), now), null);
  assert.equal(parsePendingAction("{oops", now), null);
  assert.equal(parsePendingAction(null, now), null);
  assert.ok(samePath("/music/album/r1?t=2", "/music/album/r1/"));
  assert.ok(!samePath("/music", "/music/hit"));
});
