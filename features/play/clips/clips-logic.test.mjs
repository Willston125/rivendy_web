// Rivendy Clips sur le site — règles pures (refonte du 2026-10-26).
// node --test features/play/clips/clips-logic.test.mjs  (npm run check:clips)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClipsPath, clipPath, fold, compactCount, viewsLabel, followersLabel, clockLabel, relativeDate, clipMeta, isNewClip,
  availableFilters, filterLabel, applyClipFilter, filterFromParams, clipsHref, resolveFilter, sameFilter, clipGenres,
  hasTrending, searchClips, clipArtistName, artistInitials, artistsToFollow, clipSuggestions, suggestionReasonLabel,
  commentErrorMessage, commentThreads, commentsModeNotice, parsePendingClipAction, PENDING_ACTION_TTL_MS,
  artistStatusOf, artistCta, myClipStatusLabel, discoverOrder,
} from "./clips-logic.ts";
import { foldText } from "../play-logic.ts";

const NOW = new Date("2026-10-26T12:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const clip = (id, extra = {}) => ({ id, kind: "clip", title: id, video_status: "ready", published_at: daysAgo(100), ...extra });

test("pages de la section Clips", () => {
  assert.equal(isClipsPath("/play/clips"), true);
  assert.equal(isClipsPath("/play/clips/abonnements"), true);
  assert.equal(isClipsPath("/play/clip/abc"), true);
  assert.equal(isClipsPath("/play"), false);
  assert.equal(isClipsPath("/play/movies"), false);
  assert.equal(isClipsPath("/play/clipsx"), false);
  assert.equal(isClipsPath(null), false);
  assert.equal(clipPath("a1"), "/play/clip/a1");
});

test("fold suit exactement foldText de Play", () => {
  for (const s of ["Mbayé Trambwé", "ŒUVRE", "l’île", "Ça va", "Twarab"]) assert.equal(fold(s), foldText(s));
});

test("compteurs compacts (miroir de l'app)", () => {
  assert.equal(compactCount(0), "0");
  assert.equal(compactCount(-3), "0");
  assert.equal(compactCount(950), "950");
  assert.equal(compactCount(1000), "1 k");
  assert.equal(compactCount(1250), "1,3 k");
  assert.equal(compactCount(12000), "12 k");
  assert.equal(compactCount(3_400_000), "3,4 M");
  assert.equal(viewsLabel(0), "");
  assert.equal(viewsLabel(1), "1 vue");
  assert.equal(viewsLabel(12000), "12 k vues");
  assert.equal(followersLabel(0), "");
  assert.equal(followersLabel(2), "2 abonnés");
});

test("durée d'une vignette", () => {
  assert.equal(clockLabel(null), "");
  assert.equal(clockLabel(0), "");
  assert.equal(clockLabel(222), "3:42");
  assert.equal(clockLabel(59), "0:59");
  assert.equal(clockLabel(3723), "1:02:03");
});

test("dates relatives", () => {
  assert.equal(relativeDate(null, NOW), "");
  assert.equal(relativeDate("pas une date", NOW), "");
  assert.equal(relativeDate(daysAgo(0.2), NOW), "aujourd’hui");
  assert.equal(relativeDate(daysAgo(1.2), NOW), "hier");
  assert.equal(relativeDate(daysAgo(2), NOW), "il y a 2 jours");
  assert.equal(relativeDate(daysAgo(7), NOW), "il y a 1 semaine");
  assert.equal(relativeDate(daysAgo(20), NOW), "il y a 2 semaines");
  assert.equal(relativeDate(daysAgo(65), NOW), "il y a 2 mois");
  assert.equal(relativeDate(daysAgo(800), NOW), "il y a 2 ans");
  assert.equal(clipMeta(12000, daysAgo(2), NOW), "12 k vues · il y a 2 jours");
  assert.equal(clipMeta(0, daysAgo(2), NOW), "il y a 2 jours");
  assert.equal(clipMeta(0, null, NOW), "");
});

test("badge Nouveau : publication réelle de moins de 14 jours", () => {
  assert.equal(isNewClip({ published_at: daysAgo(3) }, NOW), true);
  assert.equal(isNewClip({ published_at: daysAgo(20) }, NOW), false);
  assert.equal(isNewClip({ published_at: null }, NOW), false);
  assert.equal(isNewClip({ published_at: daysAgo(-2) }, NOW), false, "une date dans le futur n'est pas « nouvelle »");
});

test("filtres : seulement ceux que le catalogue remplit", () => {
  const old = [clip("a", { genre: "Rap" }), clip("b", { genre: "rap" }), clip("c", { genre: "Twarab" })];
  assert.deepEqual(availableFilters(old, {}, NOW).map(filterLabel), ["À découvrir", "Rap", "Twarab"]);
  const withNew = [...old, clip("d", { published_at: daysAgo(5) })];
  assert.deepEqual(availableFilters(withNew, {}, NOW).map(filterLabel), ["À découvrir", "Nouveautés", "Rap", "Twarab"]);
  const seen = { a: { views: 3, likes: 0 }, b: { views: 9, likes: 0 } };
  assert.equal(hasTrending(withNew, seen), false, "2 clips vus : pas assez pour un classement");
  const seen3 = { ...seen, c: { views: 1, likes: 0 } };
  assert.equal(hasTrending(withNew, seen3), true);
  assert.ok(availableFilters(withNew, seen3, NOW).some((f) => f.kind === "trending"));
  assert.deepEqual(clipGenres([{ genre: " Afrobeat " }, { genre: "afrobeat" }, { genre: null }]), ["Afrobeat"]);
});

test("filtres : contenu et ordre", () => {
  const list = [
    clip("old", { published_at: daysAgo(200), genre: "Rap" }),
    clip("fresh", { published_at: daysAgo(3), genre: "Twarab" }),
    clip("mid", { published_at: daysAgo(20), genre: "rap" }),
    clip("star", { published_at: daysAgo(300), featured_rank: 1 }),
  ];
  const counts = { old: { views: 50, likes: 0 }, mid: { views: 400, likes: 0 }, fresh: { views: 0, likes: 0 } };
  assert.deepEqual(applyClipFilter(list, { kind: "discover" }, counts, NOW).map((t) => t.id), ["star", "fresh", "mid", "old"]);
  assert.deepEqual(applyClipFilter(list, { kind: "new" }, counts, NOW).map((t) => t.id), ["fresh", "mid"]);
  assert.deepEqual(applyClipFilter(list, { kind: "trending" }, counts, NOW).map((t) => t.id), ["mid", "old"]);
  assert.deepEqual(applyClipFilter(list, { kind: "genre", genre: "RAP" }, counts, NOW).map((t) => t.id), ["mid", "old"]);
  assert.ok(discoverOrder(list[3], list[1]) < 0, "le clip mis en avant passe devant");
});

test("filtres ↔ adresse", () => {
  assert.deepEqual(filterFromParams(null, null), { kind: "discover" });
  assert.deepEqual(filterFromParams("nouveautes", null), { kind: "new" });
  assert.deepEqual(filterFromParams("tendances", null), { kind: "trending" });
  assert.deepEqual(filterFromParams("n'importe", null), { kind: "discover" });
  assert.deepEqual(filterFromParams("tendances", " Rap "), { kind: "genre", genre: "Rap" });
  assert.equal(clipsHref({ kind: "discover" }), "/play/clips");
  assert.equal(clipsHref({ kind: "new" }), "/play/clips?f=nouveautes");
  assert.equal(clipsHref({ kind: "trending" }, "nayro"), "/play/clips?f=tendances&q=nayro");
  assert.equal(clipsHref({ kind: "genre", genre: "Hip hop" }), "/play/clips?genre=Hip+hop");
  assert.equal(clipsHref({ kind: "discover" }, "  "), "/play/clips");
  const avail = [{ kind: "discover" }, { kind: "genre", genre: "Rap" }];
  assert.deepEqual(resolveFilter({ kind: "genre", genre: "rap" }, avail), { kind: "genre", genre: "Rap" });
  assert.deepEqual(resolveFilter({ kind: "trending" }, avail), { kind: "discover" }, "un filtre vide retombe sur À découvrir");
  assert.equal(sameFilter({ kind: "new" }, { kind: "new" }), true);
  assert.equal(sameFilter({ kind: "genre", genre: "Rap" }, { kind: "genre", genre: "Twarab" }), false);
});

test("recherche : titre, artiste, genre, sans accents", () => {
  const artists = { a1: { id: "a1", user_id: "u1", name: "Mbayé Trambwé" } };
  const list = [clip("x", { title: "Sous les étoiles", artist_id: "a1" }), clip("y", { title: "Mon île", artist: "Malia", genre: "Afrobeat" })];
  assert.deepEqual(searchClips(list, artists, "MBAYE").map((t) => t.id), ["x"]);
  assert.deepEqual(searchClips(list, artists, "etoiles").map((t) => t.id), ["x"]);
  assert.deepEqual(searchClips(list, artists, "afro").map((t) => t.id), ["y"]);
  assert.deepEqual(searchClips(list, artists, "mon ile").map((t) => t.id), ["y"]);
  assert.deepEqual(searchClips(list, artists, "zzz"), []);
  assert.equal(searchClips(list, artists, "  ").length, 2);
  // Clip de Rivendy sans nom d'artiste : la carte affiche « Rivendy », la recherche le trouve.
  assert.deepEqual(searchClips([clip("r", { title: "Code 2" })], artists, "rivendy").map((t) => t.id), ["r"]);
});

test("artiste d'un clip", () => {
  const artists = { a1: { id: "a1", user_id: "u1", name: "Nayro" } };
  assert.equal(clipArtistName({ artist_id: "a1", artist: "Ancien nom" }, artists), "Nayro");
  assert.equal(clipArtistName({ artist_id: null, artist: " Malia " }, artists), "Malia");
  assert.equal(clipArtistName({ artist_id: "inconnu", artist: null }, artists), "Rivendy");
  assert.equal(artistInitials("Mbayé Trambwé"), "MT");
  assert.equal(artistInitials(""), "R");
});

test("artistes à suivre : seulement ceux qui ont des clips ici", () => {
  const artists = {
    a1: { id: "a1", user_id: "u1", name: "Un" },
    a2: { id: "a2", user_id: "u2", name: "Deux" },
    a3: { id: "a3", user_id: "u3", name: "Sans clip" },
  };
  const list = [clip("1", { artist_id: "a1", published_at: daysAgo(9) }), clip("2", { artist_id: "a2", published_at: daysAgo(1) }),
    clip("3", { artist_id: "a2", published_at: daysAgo(30) }), clip("4", { artist_id: "absent" }), clip("5", {})];
  assert.deepEqual(artistsToFollow(list, artists).map((a) => a.id), ["a2", "a1"]);
});

test("À suivre : même artiste, même genre, puis nouveautés — sans doublon ni le clip en cours", () => {
  const cur = clip("cur", { artist_id: "a1", genre: "Rap" });
  const list = [cur,
    clip("sameArtist", { artist_id: "a1", genre: "Twarab", published_at: daysAgo(5) }),
    clip("sameGenre", { artist_id: "a2", genre: "rap", published_at: daysAgo(50) }),
    clip("newest", { artist_id: "a3", genre: "Zouk", published_at: daysAgo(1) }),
    clip("oldest", { artist_id: "a4", genre: "Zouk", published_at: daysAgo(400) }),
  ];
  const s = clipSuggestions(cur, list);
  assert.deepEqual(s.map((x) => x.clip.id), ["sameArtist", "sameGenre", "newest", "oldest"]);
  assert.deepEqual(s.map((x) => x.reason), ["artist", "genre", "new", "new"]);
  assert.equal(clipSuggestions(cur, list, 2).length, 2);
  assert.equal(suggestionReasonLabel("artist"), "Du même artiste");
  // Clip de Rivendy (sans profil) : même nom d'artiste saisi.
  const r = clip("r", { artist: "Malia" });
  const sMalia = clipSuggestions(r, [r, clip("r2", { artist: "malia", published_at: daysAgo(400) }), clip("z", { published_at: daysAgo(1) })]);
  assert.deepEqual(sMalia.map((x) => x.reason), ["artist", "new"]);
});

test("commentaires : refus du serveur en clair", () => {
  assert.match(commentErrorMessage("comments_off"), /fermés/);
  assert.match(commentErrorMessage("contact_forbidden"), /tout contact passe par Rivendy/);
  assert.match(commentErrorMessage("too_many"), /quelques minutes/);
  assert.match(commentErrorMessage(undefined), /Réessayez/);
  assert.equal(commentsModeNotice("all"), null);
  assert.match(commentsModeNotice("none"), /fermé/);
  assert.match(commentsModeNotice("followers"), /abonnés/);
});

test("fil de commentaires : épinglé d'abord, réponses rangées, comptes bloqués masqués", () => {
  const c = (id, extra = {}) => ({ id, author_id: "u", author_name: "A", body: "x", created_at: "2026-10-20T10:00:00Z", parent_id: null, likes_count: 0, pinned_at: null, creator_liked: false, ...extra });
  const list = [
    c("old", { created_at: "2026-10-01T00:00:00Z" }),
    c("new", { created_at: "2026-10-25T00:00:00Z" }),
    c("pin", { created_at: "2026-09-01T00:00:00Z", pinned_at: "2026-10-02T00:00:00Z" }),
    c("r2", { parent_id: "old", created_at: "2026-10-03T00:00:00Z" }),
    c("r1", { parent_id: "old", created_at: "2026-10-02T00:00:00Z" }),
    c("orphan", { parent_id: "gone" }),
    c("spam", { author_id: "bad" }),
  ];
  const threads = commentThreads(list, new Set(["bad"]));
  assert.deepEqual(threads.map((t) => t.comment.id), ["pin", "new", "old"]);
  assert.deepEqual(threads[2].replies.map((r) => r.id), ["r1", "r2"]);
});

test("action demandée sans compte : 30 min, type et identifiant valides", () => {
  const id = "0b9f2a7e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
  const now = 1_000_000_000;
  assert.deepEqual(parsePendingClipAction(JSON.stringify({ kind: "like", id, at: now - 1000 }), now), { kind: "like", id, at: now - 1000 });
  assert.equal(parsePendingClipAction(JSON.stringify({ kind: "like", id, at: now - PENDING_ACTION_TTL_MS - 1 }), now), null);
  assert.equal(parsePendingClipAction(JSON.stringify({ kind: "delete", id, at: now }), now), null);
  assert.equal(parsePendingClipAction(JSON.stringify({ kind: "follow", id: "pas-un-uuid", at: now }), now), null);
  assert.equal(parsePendingClipAction("{cassé", now), null);
  assert.equal(parsePendingClipAction(null, now), null);
});

test("espace artiste", () => {
  assert.equal(artistStatusOf("approved"), "approved");
  assert.equal(artistStatusOf(undefined), "none");
  assert.equal(artistStatusOf("autre"), "none");
  assert.equal(artistCta("approved"), "Publier un clip");
  assert.equal(artistCta("pending"), "Espace artiste");
  assert.equal(myClipStatusLabel({ status: "published", review_status: "approved", video_status: "ready" }), "En ligne");
  assert.equal(myClipStatusLabel({ status: "draft", review_status: "pending", video_status: "ready" }), "En vérification");
  assert.equal(myClipStatusLabel({ status: "draft", review_status: "rejected" }), "Refusé");
  assert.equal(myClipStatusLabel({ status: "published", review_status: "approved", video_status: "processing" }), "Vidéo en préparation");
  assert.equal(myClipStatusLabel({ status: "hidden", review_status: "approved", video_status: "ready" }), "Désactivé");
});
