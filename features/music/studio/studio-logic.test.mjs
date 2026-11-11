// Rivendy Musique — publier depuis le site : règles pures (lots 0 à 2, 2026-11-11).
// Mêmes cas que l'app (test/features/musique/musique_studio_test.dart,
// test/features/play/play_lot_c_test.dart) : les deux portes suivent les
// mêmes règles.
// node --test features/music/studio/studio-logic.test.mjs  (npm run check:studio)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STUDIO, tracksFor, isEditable, trackHasFile, trackStatusLabel, submitProblem, submitChecklist, fileProblem,
  titleFromFile, playsLabel, megabytesLabel, isoDay, studioErrorMessage, ARTIST, hasContactInfo, artistTextProblem,
  artistProfileProblem, artistErrorMessage, publishPhase, followMessage, originGroups, originLabel,
} from "./studio-logic.ts";

const ready = { state: "draft", hasCover: true, hasGenre: true, tracks: [{ hasFile: true }], attested: true };

test("titres au plus par type de sortie (single 3, EP 8, album 30)", () => {
  assert.equal(tracksFor("single"), 3);
  assert.equal(tracksFor("ep"), 8);
  assert.equal(tracksFor("album"), 30);
});

test("modifiable seulement en brouillon ou refusée, comme le serveur", () => {
  assert.equal(isEditable("draft"), true);
  assert.equal(isEditable("rejected"), true);
  for (const s of ["pending", "approved", "published", "archived"]) assert.equal(isEditable(s), false, s);
});

test("fichier d'un titre : reçu, en préparation ou prêt", () => {
  assert.equal(trackHasFile("uploaded"), true);
  assert.equal(trackHasFile("processing"), true);
  assert.equal(trackHasFile("ready"), true);
  assert.equal(trackHasFile("missing"), false);
  assert.equal(trackHasFile("error"), false);
  assert.equal(trackHasFile(null), false);
  assert.equal(trackStatusLabel("uploaded"), "Fichier reçu");
  assert.equal(trackStatusLabel("error"), "Erreur — renvoyez le fichier");
  assert.equal(trackStatusLabel(undefined), "Fichier manquant");
});

test("envoi : prête quand tout y est et que les droits sont attestés", () => {
  assert.equal(submitProblem(ready), null);
});

test("envoi : chaque manque est signalé, dans l'ordre du formulaire", () => {
  assert.equal(submitProblem({ ...ready, hasCover: false }), "Ajoutez une pochette.");
  assert.equal(submitProblem({ ...ready, hasGenre: false }), "Choisissez un genre.");
  assert.equal(submitProblem({ ...ready, tracks: [] }), "Ajoutez au moins un titre.");
  assert.equal(submitProblem({ ...ready, attested: false }), "Cochez l’attestation des droits.");
  assert.equal(submitProblem({ ...ready, tracks: [{ hasFile: false }] }), "Un titre n’a pas encore son fichier.");
  assert.equal(submitProblem({ ...ready, tracks: [{ hasFile: true }, { hasFile: false }, { hasFile: false }] }),
    "2 titres n’ont pas encore leur fichier.");
});

test("envoi : une sortie en vérification ne se renvoie pas", () => {
  assert.equal(submitProblem({ ...ready, state: "pending" }), "Cette sortie ne peut plus être envoyée.");
  assert.equal(submitProblem({ ...ready, state: "rejected" }), null);
});

test("liste « Avant l'envoi » : toutes les conditions à la fois", () => {
  const list = submitChecklist({ hasCover: true, hasGenre: false, tracks: [{ hasFile: true }, { hasFile: false }], attested: false });
  assert.deepEqual(list.map((i) => [i.key, i.ok]), [["cover", true], ["genre", false], ["tracks", true], ["files", false], ["attest", false]]);
  assert.equal(list.find((i) => i.key === "files").label, "1 titre sans fichier");
  assert.equal(list.find((i) => i.key === "tracks").label, "2 titres");
  const empty = submitChecklist({ hasCover: false, hasGenre: true, tracks: [], attested: true });
  assert.equal(empty.find((i) => i.key === "files").ok, false);
  assert.equal(empty.find((i) => i.key === "tracks").label, "Ajoutez au moins un titre");
});

test("fichiers : formats et taille, vérifiés avant tout envoi", () => {
  assert.equal(fileProblem("a.MP3", 1000), null);
  assert.equal(fileProblem("a.flac", STUDIO.maxFileBytes), null);
  assert.match(fileProblem("a.ogg", 1000), /MP3, M4A, WAV ou FLAC/);
  assert.match(fileProblem("sans_extension", 1000), /MP3, M4A, WAV ou FLAC/);
  assert.match(fileProblem("a.wav", 0), /vide/);
  assert.match(fileProblem("a.wav", STUDIO.maxFileBytes + 1), /200 Mo/);
});

test("titre proposé d'après le nom du fichier", () => {
  assert.equal(titleFromFile("02 - Twarab ya Moroni.mp3"), "Twarab ya Moroni");
  assert.equal(titleFromFile("01_mon_titre.wav"), "mon titre");
  assert.equal(titleFromFile("Ngoma.m4a"), "Ngoma");
  assert.equal(titleFromFile(".mp3"), "Titre");
  assert.equal(titleFromFile(`${"x".repeat(200)}.mp3`).length, STUDIO.titleMax);
});

test("écoutes et tailles lisibles", () => {
  assert.equal(playsLabel(0), "0 écoute");
  assert.equal(playsLabel(1), "1 écoute");
  assert.equal(playsLabel(1250), "1 250 écoutes");
  assert.equal(megabytesLabel(28.4 * 1024 * 1024), "28 Mo");
  assert.equal(megabytesLabel(3.25 * 1024 * 1024), "3,3 Mo");
});

test("date de sortie au format du serveur", () => {
  assert.equal(isoDay(new Date(2026, 10, 1)), "2026-11-01");
  assert.equal(isoDay(new Date(999, 0, 9)), "0999-01-09");
});

test("refus du serveur traduits, comme l'app", () => {
  assert.equal(studioErrorMessage("quota_exceeded"), "Vous avez atteint 10 sorties ce mois-ci.");
  assert.equal(studioErrorMessage("ARTIST_REQUIRED"), "Votre compte artiste doit être validé par Rivendy.");
  assert.equal(studioErrorMessage("too_large"), "Le fichier dépasse 200 Mo.");
  assert.equal(studioErrorMessage("inconnu"), "Une erreur est survenue, réessayez.");
  assert.equal(artistErrorMessage("bad_name"), "Nom d’artiste : 2 à 60 caractères.");
  assert.equal(artistErrorMessage(null), "Action impossible pour le moment, réessayez.");
});

test("règle Contact : ni numéro, ni WhatsApp, ni lien (miroir de l'app et du serveur)", () => {
  assert.equal(hasContactInfo("Appelez le 33 12 34 56"), true);
  assert.equal(hasContactInfo("Mon WhatsApp"), true);
  assert.equal(hasContactInfo("voir www.site.km"), true);
  assert.equal(hasContactInfo("amina.com"), true);
  assert.equal(hasContactInfo("Rap comorien depuis 2019, album 2024"), false);
});

test("profil d'artiste : nom, genre, biographie, règles — dans l'ordre de l'app", () => {
  const ok = { name: "Waza", genre: "Twarab", bio: "", rules: true };
  assert.equal(artistProfileProblem(ok), null);
  assert.equal(artistProfileProblem({ ...ok, name: "W" }), "Nom d’artiste : 2 caractères au moins.");
  assert.equal(artistProfileProblem({ ...ok, name: "x".repeat(ARTIST.nameMax + 1) }), "Nom d’artiste trop long (60 caractères au plus).");
  assert.equal(artistProfileProblem({ ...ok, genre: "x".repeat(ARTIST.genreMax + 1) }), "Genre musical trop long (40 caractères au plus).");
  assert.equal(artistProfileProblem({ ...ok, bio: "Écrivez-moi au 3312345" }), "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.");
  assert.equal(artistProfileProblem({ ...ok, rules: false }), "Acceptez les règles des artistes pour continuer.");
  // Nom validé par Rivendy : il ne se change que par une demande, le formulaire ne le vérifie plus.
  assert.equal(artistProfileProblem({ ...ok, name: "", nameLocked: true }), null);
  assert.equal(artistTextProblem("  ", { field: "Nom d’artiste", min: 1, max: 60 }), "Nom d’artiste obligatoire.");
});

test("feuille « Publier » de la Musique : ce qu'elle propose selon le compte", () => {
  const base = { signedIn: true, loading: false, error: false, status: "approved", musicEnabled: true };
  assert.equal(publishPhase({ ...base, signedIn: false }), "login");
  assert.equal(publishPhase({ ...base, loading: true }), "loading");
  assert.equal(publishPhase({ ...base, error: true }), "error");
  assert.equal(publishPhase({ ...base, status: "none" }), "become");
  assert.equal(publishPhase({ ...base, status: "pending" }), "follow");
  assert.equal(publishPhase({ ...base, status: "rejected" }), "follow");
  assert.equal(publishPhase({ ...base, status: "suspended" }), "follow");
  assert.equal(publishPhase({ ...base, musicEnabled: false }), "enable");
  // Absent = Musique activée, comme l'app.
  assert.equal(publishPhase({ ...base, musicEnabled: null }), "publish");
  assert.equal(publishPhase(base), "publish");
  assert.match(followMessage("rejected", "Photo floue"), /Motif : Photo floue$/);
  assert.match(followMessage("pending", null), /en vérification/);
  assert.match(followMessage("suspended", null), /suspendu/);
});

test("origines : pays triés sans tenir compte des accents, régions et îles rattachées", () => {
  const all = [
    { id: "SN", name: "Sénégal", kind: "country", parent_id: null, iso: "SN", country_id: null },
    { id: "KM", name: "Comores", kind: "country", parent_id: null, iso: "KM", country_id: "KM" },
    { id: "EG", name: "Égypte", kind: "country", parent_id: null, iso: "EG", country_id: null },
    { id: "km-ngazidja", name: "Ngazidja", kind: "island", parent_id: "KM", iso: null, country_id: "KM" },
    { id: "km-anjouan", name: "Ndzuwani", kind: "island", parent_id: "KM", iso: null, country_id: "KM" },
  ];
  const groups = originGroups(all);
  assert.deepEqual(groups.map((g) => g.country.name), ["Comores", "Égypte", "Sénégal"]);
  assert.deepEqual(groups[0].children.map((c) => c.name), ["Ndzuwani", "Ngazidja"]);
  assert.equal(originLabel(all, "km-ngazidja"), "Ngazidja · Comores");
  assert.equal(originLabel(all, "SN"), "Sénégal");
  assert.equal(originLabel(all, "inconnue"), "");
  assert.equal(originLabel(all, null), "");
});
