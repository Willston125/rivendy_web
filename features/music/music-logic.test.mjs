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
  // resize=contain : proportions gardées (sans lui, Supabase recadre à la hauteur d'origine).
  assert.equal(thumbUrl(u, 320), "https://x.supabase.co/storage/v1/render/image/public/music-images/artists/a/1.jpg?width=320&resize=contain&quality=70");
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

// ── Finitions du 2026-10-22 ────────────────────────────────────────────────
import { playerDuration, formatPlayerTime, homeShelves, recentIsUseful, heroHitBadge } from "./music-logic.ts";

test("lecteur : durée du fichier une fois chargé, sinon celle du titre en base, sinon inconnue", () => {
  // File reprise après rechargement : rien n'est chargé → la durée du titre (plus de « 0:00 »).
  assert.equal(playerDuration({ ready: false, mediaDuration: 0, trackDuration: 209 }), 209);
  // Fichier chargé (extrait de 30 s compris) : la vraie durée du fichier.
  assert.equal(playerDuration({ ready: true, mediaDuration: 30, trackDuration: 209 }), 30);
  // Métadonnées pas encore là (NaN) : la durée en base.
  assert.equal(playerDuration({ ready: true, mediaDuration: NaN, trackDuration: 186 }), 186);
  assert.equal(playerDuration({ ready: false, mediaDuration: 0, trackDuration: null }), null);
  assert.equal(playerDuration({ ready: false, mediaDuration: 0, trackDuration: 0 }), null);
  assert.equal(formatPlayerTime(209), "3:29");
  assert.equal(formatPlayerTime(null), "–:––");
});

test("accueil : jamais les mêmes cartes deux fois, regroupées quand les nouveautés n'ajoutent rien", () => {
  const A = { id: "a" }, B = { id: "b" }, C = { id: "c" }, D = { id: "d" }, E = { id: "e" };
  assert.deepEqual(homeShelves([A, B], [B, A]), { mode: "one", title: "La sélection Rivendy", releases: [A, B] });
  assert.deepEqual(homeShelves([A], [B, A]), { mode: "one", title: "La sélection et les nouveautés", releases: [A, B] });
  assert.deepEqual(homeShelves([], [A, B]), { mode: "one", title: "Nouveautés", releases: [A, B] });
  assert.deepEqual(homeShelves([A], [B, C, D, A, E]), { mode: "two", selection: [A], news: [B, C, D, E] });
});

test("accueil : « Écoutés récemment » seulement s'il montre au moins 2 autres sorties", () => {
  const shown = new Set(["a", "b"]);
  assert.equal(recentIsUseful(["a", "b", "a"], shown), false);
  assert.equal(recentIsUseful(["a", "c"], shown), false);
  assert.equal(recentIsUseful(["c", "d", "c"], shown), true);
});

test("bannière : « N° 1 du Rivendy Hit » seulement s'il est vraiment premier", () => {
  assert.deepEqual(heroHitBadge(null, "r1"), { kind: "none" });
  assert.deepEqual(heroHitBadge({ rank: 2, releaseId: "r1" }, "r1"), { kind: "none" });
  assert.deepEqual(heroHitBadge({ rank: 1, releaseId: "r1" }, "r1"), { kind: "same" });
  assert.deepEqual(heroHitBadge({ rank: 1, releaseId: "r2" }, "r1"), { kind: "other" });
  assert.deepEqual(heroHitBadge({ rank: 1, releaseId: null }, "r1"), { kind: "none" });
});

// ── Mise en page « application » ───────────────────────────────────────────
import {
  latestIso, sortLibrary, filterLibrary, libraryKinds, totalDurationLabel, addedAtLabel, clampPanel, fitPanels, headerTint,
} from "./music-logic.ts";

const E = (o) => ({ key: o.kind + o.id, href: "/", cover: null, subtitle: "", addedAt: null, usedAt: null, ...o });

test("bibliothèque : « Titres likés » en tête, puis récents, ajoutés, ou alphabétique", () => {
  const items = [
    E({ kind: "album", id: "a", title: "Zouk love", addedAt: "2026-10-01T10:00:00Z", usedAt: "2026-10-20T10:00:00Z" }),
    E({ kind: "playlist", id: "p", title: "Éclats", addedAt: "2026-10-10T10:00:00Z", usedAt: "2026-10-10T10:00:00Z" }),
    E({ kind: "liked", id: "liked", title: "Titres likés", pinned: true, addedAt: "2026-09-01T10:00:00Z" }),
    E({ kind: "artist", id: "r", title: "Ali", addedAt: "2026-10-15T10:00:00Z" }),
  ];
  assert.deepEqual(sortLibrary(items, "recent").map((e) => e.id), ["liked", "a", "r", "p"]);
  assert.deepEqual(sortLibrary(items, "added").map((e) => e.id), ["liked", "r", "p", "a"]);
  assert.deepEqual(sortLibrary(items, "alpha").map((e) => e.id), ["liked", "r", "p", "a"]);
  assert.equal(latestIso(null, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"), "2026-02-01T00:00:00Z");
  assert.equal(latestIso(null, undefined), null);
});

test("bibliothèque : filtres présents seulement, recherche sans accents", () => {
  const items = [
    E({ kind: "liked", id: "liked", title: "Titres likés", pinned: true }),
    E({ kind: "album", id: "a", title: "Mélodie", subtitle: "Album • Waza" }),
  ];
  assert.deepEqual(libraryKinds(items), ["playlist", "album"]);
  assert.deepEqual(libraryKinds([]), []);
  assert.deepEqual(filterLibrary(items, "playlist", "").map((e) => e.id), ["liked"]);
  assert.deepEqual(filterLibrary(items, null, "melo").map((e) => e.id), ["a"]);
  assert.deepEqual(filterLibrary(items, null, "waza").map((e) => e.id), ["a"]);
});

test("durée totale et date d'ajout", () => {
  assert.equal(totalDurationLabel(209), "3 min 29 s");
  assert.equal(totalDurationLabel(1873), "31 min 13 s");
  assert.equal(totalDurationLabel(3600 * 2 + 300), "2 h 05 min");
  assert.equal(totalDurationLabel(90_000), "plus de 24 h");
  assert.equal(totalDurationLabel(45), "45 s");
  const now = Date.parse("2026-10-22T15:00:00");
  assert.equal(addedAtLabel("2026-10-22T08:00:00", now), "aujourd’hui");
  assert.equal(addedAtLabel("2026-10-21T23:00:00", now), "hier");
  assert.equal(addedAtLabel("2026-10-17T12:00:00", now), "il y a 5 jours");
  assert.equal(addedAtLabel("2026-02-14T12:00:00", now), "14 févr. 2026");
  assert.equal(addedAtLabel(null, now), "");
});

test("panneaux : bornes, et le centre garde sa largeur minimale", () => {
  assert.equal(clampPanel(500, 240, 440), 440);
  assert.equal(clampPanel(100, 240, 440), 240);
  assert.equal(clampPanel(NaN, 240, 440), 240);
  // 1280 px utiles : 440 + 440 + 480 > 1280 → la droite cède d'abord, puis la gauche.
  assert.deepEqual(fitPanels({ available: 1280, left: 440, right: 440, leftMin: 240, rightMin: 280, centerMin: 480 }), { left: 440, right: 360 });
  assert.deepEqual(fitPanels({ available: 1000, left: 440, right: 440, leftMin: 240, rightMin: 280, centerMin: 480 }), { left: 240, right: 280 });
  assert.deepEqual(fitPanels({ available: 1600, left: 300, right: 340, leftMin: 240, rightMin: 280, centerMin: 480 }), { left: 300, right: 340 });
});

test("teinte d'en-tête : assombrie jusqu'à un texte blanc lisible", () => {
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  for (const c of [[250, 240, 200], [0, 191, 165], [30, 30, 60]]) {
    const t = headerTint(c);
    assert.ok(1.05 / (lum(t) + 0.05) >= 4.5, `${c} → ${t}`);
  }
  assert.deepEqual(headerTint([30, 30, 60]), [30, 30, 60]);
});

import { HOME_SHOWS, usefulRubrics, shortcutFill, installHint, INSTALL_HINT_SNOOZE_MS } from "./music-logic.ts";

test("accueil, petit catalogue : pas de raccourci vers une page qui répète l'accueil ou une page vide", () => {
  // Le catalogue d'aujourd'hui : 2 sorties, 2 titres au Hit, 1 artiste, aucun clip.
  assert.deepEqual(usefulRubrics({ hitTracks: 2, releases: 2, artists: 1, clips: 0 }), []);
  assert.deepEqual(usefulRubrics({ hitTracks: 2, releases: 2, artists: 1, clips: 3 }), ["clips"]);
  assert.deepEqual(
    usefulRubrics({ hitTracks: HOME_SHOWS.hit + 1, releases: HOME_SHOWS.releases + 1, artists: HOME_SHOWS.artists + 1, clips: 1 }),
    ["hit", "explore", "artists", "clips"],
  );
  assert.deepEqual(usefulRubrics({ hitTracks: HOME_SHOWS.hit, releases: HOME_SHOWS.releases, artists: HOME_SHOWS.artists, clips: 0 }), []);
});

test("raccourcis : des rangées pleines (2, 3, 4, 6 ou 8)", () => {
  assert.equal(shortcutFill(2, 5), 2); // titres likés + historique + 2 entrées = 4
  assert.equal(shortcutFill(2, 1), 1); // 3
  assert.equal(shortcutFill(3, 5), 1); // 4, pas 5
  assert.equal(shortcutFill(4, 5), 2); // 6
  assert.equal(shortcutFill(5, 5), 1); // 6
  assert.equal(shortcutFill(6, 5), 2); // 8
  assert.equal(shortcutFill(0, 0), 0); // visiteur : rien à ajouter
  assert.equal(shortcutFill(7, 5), 1); // 8
  assert.equal(shortcutFill(8, 5), 0);
});

test("écran d'accueil : iPhone, appli Android, jamais dans une appli ni après « Plus tard »", () => {
  const now = Date.UTC(2026, 9, 23);
  const base = { standalone: false, touchPoints: 5, dismissedAt: null, now };
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  const webview = "Mozilla/5.0 (Linux; Android 14; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36";
  const facebook = `${iphone} [FBAN/FBIOS;FBAV/480.0]`;
  const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  assert.equal(installHint({ ...base, ua: iphone }), "ios");
  assert.equal(installHint({ ...base, ua: ipad }), "ios");
  assert.equal(installHint({ ...base, ua: ipad, touchPoints: 0 }), null); // un vrai Mac
  assert.equal(installHint({ ...base, ua: android }), "android");
  assert.equal(installHint({ ...base, ua: webview }), null);
  assert.equal(installHint({ ...base, ua: facebook }), null);
  assert.equal(installHint({ ...base, ua: desktop, touchPoints: 0 }), null);
  assert.equal(installHint({ ...base, ua: iphone, standalone: true }), null);
  assert.equal(installHint({ ...base, ua: iphone, dismissedAt: now - 1000 }), null);
  assert.equal(installHint({ ...base, ua: iphone, dismissedAt: now - INSTALL_HINT_SNOOZE_MS - 1 }), "ios");
});
