// Rivendy Play — publier des vidéos depuis le site : règles pures (lots 3 et 4, 2026-11-11).
// Mêmes règles que l'app (artist_models.dart, play_create_service.dart,
// shorts_service.dart, video_service.dart) : les deux portes suivent les mêmes.
// node --test features/play/create/create-logic.test.mjs  (npm run check:create)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIP, SHORT, TUS, retryDelayMs, isRetryableStatus, parseOffset, CONTACT_MESSAGE, hasContact, clipTextProblem,
  clipFormProblem, freeShortCaptionProblem, SHORT_RULES, clock, megabytes, clipFileProblem, shortFileProblem,
  UNREADABLE_VIDEO, shortStatusLabel, shortIsOnline, shortStatusTone, toShortArticle, articleStatusNote,
  filterShortArticles, videoTicketMessage, clipErrorMessage, shortSubmitMessage, commentsModeOf, commentsModeLabel,
  commentsModeHint,
} from "./create-logic.ts";

const MB = 1024 * 1024;

test("limites : clip 10 min / 200 Mo / 10 par mois, Short 30 s / 300 signes, morceaux de 5 Mio", () => {
  assert.equal(CLIP.maxSeconds, 600);
  assert.equal(CLIP.maxBytes, 200 * MB);
  assert.equal(CLIP.perMonth, 10);
  assert.equal(SHORT.maxSeconds, 30);
  assert.equal(SHORT.captionMax, 300);
  assert.equal(TUS.chunkBytes, 5 * MB);
  assert.equal(TUS.maxRetries, 5);
});

test("reprise : 1, 2, 4, 8, 16 s ; relire la position sur 409, 408, 429 et 5xx", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(retryDelayMs), [1000, 2000, 4000, 8000, 16000]);
  for (const s of [409, 408, 429, 500, 503, 0]) assert.equal(isRetryableStatus(s), true, String(s));
  for (const s of [200, 204, 400, 403, 404, 410]) assert.equal(isRetryableStatus(s), false, String(s));
  assert.equal(parseOffset("5242880"), 5242880);
  assert.equal(parseOffset(" 12 "), 12);
  assert.equal(parseOffset(null), null);
  assert.equal(parseOffset("abc"), null);
});

test("règle Contact : numéro, WhatsApp, Telegram, lien, domaine", () => {
  assert.equal(hasContact("Appelez le 33 12 34 56"), true);
  assert.equal(hasContact("mon whats app"), true);
  assert.equal(hasContact("telegram @moi"), true);
  assert.equal(hasContact("voir https://exemple.org"), true);
  assert.equal(hasContact("rivendy.km"), true);
  assert.equal(hasContact("Clip tourné à Moroni en 2025"), false);
});

test("texte d'un clip : obligatoire, longueur, contact", () => {
  assert.equal(clipTextProblem("", { min: 1, max: 120, field: "Titre" }), "Titre obligatoire.");
  assert.equal(clipTextProblem("a".repeat(121), { min: 1, max: 120, field: "Titre" }), "Titre trop long (120 caractères au plus).");
  assert.equal(clipTextProblem("WhatsApp 3312345", { max: 1000, field: "Description" }), CONTACT_MESSAGE);
  assert.equal(clipTextProblem("Afro", { max: 40, field: "Genre" }), null);
});

test("formulaire d'un clip : la vidéo d'abord, puis titre, description, genre", () => {
  const ok = { editing: false, hasVideo: true, title: "Mon clip", description: "", genre: "Afro" };
  assert.equal(clipFormProblem(ok), null);
  assert.equal(clipFormProblem({ ...ok, hasVideo: false }), "Choisissez la vidéo du clip.");
  assert.equal(clipFormProblem({ ...ok, hasVideo: false, editing: true }), null);
  assert.equal(clipFormProblem({ ...ok, title: "  " }), "Titre obligatoire.");
  assert.equal(clipFormProblem({ ...ok, genre: "g".repeat(41) }), "Genre trop long (40 caractères au plus).");
});

test("légende d'un Short libre : longueur, numéro, lien, mot interdit", () => {
  assert.equal(freeShortCaptionProblem(""), null);
  assert.equal(freeShortCaptionProblem("x".repeat(301)), "Légende trop longue (300 signes au plus).");
  assert.equal(freeShortCaptionProblem("Appelez +269 33 12 34 5"), CONTACT_MESSAGE);
  assert.equal(freeShortCaptionProblem("écrivez-moi sur watsap"), CONTACT_MESSAGE);
  assert.equal(freeShortCaptionProblem("www.monsite.com"), "Pas de lien dans la légende : tout contact passe par Rivendy.");
  assert.equal(freeShortCaptionProblem("un mot", () => true), "La légende contient un mot non autorisé.");
  assert.equal(freeShortCaptionProblem("Journée à la plage", () => false), null);
  assert.equal(SHORT_RULES.length, 5);
});

test("durée et poids lisibles", () => {
  assert.equal(clock(222), "3:42");
  assert.equal(clock(24.4), "0:24");
  assert.equal(clock(Number.NaN), "0:00");
  assert.equal(megabytes(86 * MB), "86 Mo");
  assert.equal(megabytes(10), "1 Mo");
});

test("vidéo d'un clip : illisible, trop longue, trop courte, trop lourde", () => {
  assert.equal(clipFileProblem(Number.NaN, MB), UNREADABLE_VIDEO);
  assert.equal(clipFileProblem(Infinity, MB), UNREADABLE_VIDEO);
  assert.equal(clipFileProblem(602, MB), "Clip trop long : 10 minutes au plus.");
  assert.equal(clipFileProblem(600.9, MB), null);
  assert.equal(clipFileProblem(4, MB), "Vidéo trop courte.");
  assert.equal(clipFileProblem(222, 201 * MB), "Fichier trop lourd (200 Mo au plus) : exportez le clip en 720p puis réessayez.");
  assert.equal(clipFileProblem(222, 86 * MB), null);
});

test("vidéo d'un Short : 30 s au plus, la durée est dite", () => {
  assert.equal(shortFileProblem(24), null);
  assert.equal(shortFileProblem(30.4), null);
  assert.equal(shortFileProblem(72), "Votre vidéo dure 1:12 : 30 secondes au plus.");
  assert.equal(shortFileProblem(0.5), "Vidéo trop courte.");
  assert.equal(shortFileProblem(Number.NaN), UNREADABLE_VIDEO);
});

test("statut d'un Short (MyShort.statusLabel)", () => {
  const s = (status, video_status = "ready", moderation_reason = null) => ({ status, video_status, moderation_reason });
  assert.equal(shortStatusLabel(s("published")), "En ligne");
  assert.equal(shortStatusLabel(s("published", "processing")), "Vidéo en préparation");
  assert.equal(shortStatusLabel(s("rejected")), "Refusé");
  assert.equal(shortStatusLabel(s("removed")), "Retiré");
  assert.equal(shortStatusLabel(s("pending")), "En vérification");
  assert.equal(shortStatusLabel(s("pending", "ready", "Signalé")), "À revérifier");
  assert.equal(shortIsOnline(s("published")), true);
  assert.equal(shortIsOnline(s("published", "processing")), false);
  assert.equal(shortStatusTone(s("published")), "online");
  assert.equal(shortStatusTone(s("pending")), "pending");
  assert.equal(shortStatusTone(s("rejected")), "rejected");
  assert.equal(shortStatusTone(s("removed")), "neutral");
});

test("articles d'un Short : ligne, mention, recherche sans accents, « Sans vidéo »", () => {
  const a = toShortArticle({ id: "1", title: "  Robe Wax brodée ", photos: ["https://x/1.jpg"], status: "active", video_uid: "abc" });
  assert.deepEqual(a, { id: "1", title: "Robe Wax brodée", photo: "https://x/1.jpg", status: "active", hasVideo: true });
  const b = toShortArticle({ id: "2", title: "", photos: null, status: null, video_uid: null });
  assert.equal(b.title, "Article sans titre");
  assert.equal(b.status, "pending");
  assert.equal(b.hasVideo, false);
  assert.equal(articleStatusNote("pending"), "En attente");
  assert.equal(articleStatusNote("epuise"), "Épuisé");
  assert.equal(articleStatusNote("boosted"), "Boosté");
  assert.equal(articleStatusNote("active"), null);
  const all = [a, b, toShortArticle({ id: "3", title: "Épices de Mohéli", status: "epuise" })];
  assert.deepEqual(filterShortArticles(all, "BRODEE").map((x) => x.id), ["1"]);
  assert.deepEqual(filterShortArticles(all, "epices").map((x) => x.id), ["3"]);
  assert.deepEqual(filterShortArticles(all, "", true).map((x) => x.id), ["2", "3"]);
});

test("messages : quota, cadence, clip, Short", () => {
  assert.equal(videoTicketMessage("QUOTA_EXCEEDED", 3), "Quota vidéo atteint (3 ce mois-ci). Passez à une formule supérieure pour en publier plus.");
  assert.equal(videoTicketMessage("QUOTA_EXCEEDED"), "Quota vidéo atteint. Passez à une formule supérieure pour en publier plus.");
  assert.equal(videoTicketMessage("RATE_LIMITED"), "Trop d’envois d’affilée : réessayez dans une minute.");
  assert.equal(videoTicketMessage("INTERNAL"), "L’envoi de la vidéo a échoué, réessayez.");
  assert.equal(clipErrorMessage("QUOTA_EXCEEDED"), "Vous avez déjà envoyé 10 clips ce mois-ci.");
  assert.equal(clipErrorMessage("ARTIST_REQUIRED"), "Votre compte artiste doit être validé par Rivendy avant d’envoyer un clip.");
  assert.equal(clipErrorMessage("already_submitted"), "La vidéo n’a pas été reçue, réessayez.");
  assert.equal(clipErrorMessage("???"), "Action impossible pour le moment, réessayez.");
  assert.equal(shortSubmitMessage("no_market"), "Choisissez d’abord votre pays dans votre profil.");
  assert.equal(shortSubmitMessage("contact_forbidden"), CONTACT_MESSAGE);
  assert.equal(shortSubmitMessage(null), "L’envoi du Short a échoué, réessayez.");
});

test("qui peut commenter : tout le monde par défaut", () => {
  assert.equal(commentsModeOf(null), "all");
  assert.equal(commentsModeOf("followers"), "followers");
  assert.equal(commentsModeOf("bizarre"), "all");
  assert.equal(commentsModeLabel("all"), "Tout le monde");
  assert.equal(commentsModeLabel("followers"), "Mes abonnés");
  assert.equal(commentsModeLabel("none"), "Personne");
  assert.equal(commentsModeHint("none"), "Commentaires fermés ; vous pouvez toujours écrire.");
});
