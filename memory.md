# Rivendy Web App - Memory & Status

## Présentation du Projet
Rivendy est une plateforme de marketplace (Mise en relation Acheteurs/Vendeurs) opérant de façon multi-marchés (Comores, Djibouti, etc.), disposant d'une application mobile (Flutter) et d'une version web (Next.js). L'objectif est d'avoir une **parité parfaite** entre les fonctionnalités de l'App mobile et du Site Web.

## Technologies
- **Frontend** : Next.js 16.3.8 (App Router, depuis le 2026-10-08), React 19, Tailwind CSS, Lucide React
- **Backend / BDD** : Supabase (PostgreSQL, Authentification, Storage)
- **Déploiement** : Vercel (Front) & GitHub (Code source)

---

## Dernières Corrections Majeures & Audit (Juin 2026)

Un audit complet a été réalisé pour résoudre les bugs bloquants, les incohérences de logique métier et les problèmes d'affichage géolocalisé :

### 1. Fiabilisation du sélecteur de pays & Élimination des fallbacks codés en dur
- **Correction du Bug de Sélection Géographique** : Les utilisateurs de certaines régions (ex: Comores) étaient systématiquement redirigés vers le marché de Djibouti. Nous avons modifié `country-provider.tsx` et `market-url-sync.tsx` afin de stocker et synchroniser proprement le pays via localStorage, profil Supabase, et paramètres d'URL (`?country=`).
- **Suppression des valeurs "en dur" (Hardcodes)** : Remplacement de toutes les occurrences de `"DJ"` et `"FDJ"` dans les formulaires de checkout, pages de produits, pages vendeurs, et utilitaires de formatage par des variables dynamiques issues du pays sélectionné.

### 2. Résolution des Hook Violations (React Rules)
- **Problème** : 14 composants (dont `orders-view.tsx`, `wallet-view.tsx`, `seller-dashboard.tsx`) retournaient un rendu prématuré (`if (!country) return null;`) avant d'appeler les hooks `useState` et `useEffect`. Cela brisait les règles de cycle de vie de React et provoquait des erreurs au re-rendu.
- **Correction** : Les gardes conditionnelles ont été déplacées après tous les hooks d'état et d'effets de chaque composant, en sécurisant les accès aux propriétés (`country?.id` ou `country?.currency_code`).

### 3. Logique Métier Portefeuille & Statut de Livraison
- **Synchronisation du statut `delivered_confirmed`** : Ce statut (marqué par l'admin via RPC pour valider les codes de livraison à 6 chiffres) était ignoré sur le Web. Il a été ajouté dans le système de types, le filtrage des commandes acheteurs (`orders-view.tsx`), et le dashboard vendeur (`seller-dashboard.tsx`, `seller-sales-view.tsx`).
- **Portefeuille (`wallet-view.tsx`) — corrigé réellement le 2026-08-22** : la version précédente de cette note annonçait une correction absente du code. Depuis le commit `4d1383d` : le compteur « Livrées » lit `status` (`completed`/`delivered`/`delivered_by_rider`/`delivered_confirmed` — même convention que `seller-dashboard`), les commandes annulées sont exclues des gains en attente, et le solde confirmé vient exclusivement de `wallets.balance` (serveur).
- **Sidebar dynamique** : Le solde affiché dans la barre latérale gauche (`left-sidebar.tsx`) a été rendu dynamique en requêtant directement Supabase au lieu d'afficher une valeur hardcodée (`12450`).

### 4. Validation Technique
- Le projet compile avec succès sans aucune erreur TypeScript (`npx tsc --noEmit` validé à 0 erreur).

---

## Fonctionnalités Implémentées (Parité Web/App)

### 1. Expérience Client (Acheteur)
- **Catalogue & Recherche** : 
  - Filtre par sous-catégories (SubcategoryFilter).
  - Onglet de recherche mis à jour avec les mêmes filtres.
- **Sélecteur de Marché** : Intégration du sélecteur de pays/marché en Header Desktop (sauvegardé en `localStorage`).
- **Supermarché (Alimentation)** : Mise en page spécifique `FoodCard` pour la catégorie "Alimentation" et "Restaurant".
- **Code de Livraison** : Modal pour saisir le code de livraison à 6 chiffres (confirmation de réception).
- **Signalement (Report)** : Bouton et modal pour signaler un produit inapproprié ou un vendeur (`product_reports` et `seller_reports`).

### 2. Expérience Vendeur
- **Gestion des Commandes** : Nouvel onglet "Commandes" dans la Garde-Robe (`seller-sales-view.tsx`) avec la possibilité de contacter l'acheteur directement sur WhatsApp.
- **Stories** : Bouton "Story" pour mettre en avant temporairement un produit.
- **Réseaux Sociaux** : Les vendeurs peuvent ajouter leurs liens Facebook, Instagram, et TikTok sur leur profil.
- **Création de Boutique** : Adaptation du formulaire de création pour masquer l'état des produits (Neuf/Occasion) si la catégorie est Restaurant ou Alimentation.
- **Vendeur Certifié** : Ajout du badge vérifié (Check bleu/vert) sur les fiches produits des vendeurs certifiés.
- **Impression Catalogue** : Page dédiée pour imprimer son catalogue de produits avec un QR Code (CSS `@media print`).

### 3. Interface Globale & UI
- **Partage** : Boutons natifs pour partager une boutique ou un produit.
- **Pied de page (LeftSidebar)** : Ajout des liens vers les réseaux sociaux officiels de Rivendy et intégration dynamique du solde.
- **Pages Légales** : CGU et Politique de confidentialité consultables à `/legal`.

---

## Base de données (Supabase)
Les migrations suivantes ont été ajoutées pour synchroniser les schémas Web et Flutter :
- `20260509_rivendy_web_compat.sql` : Patch idempotent pour les statuts (`pending`, `epuise`, `rejected`) et les catégories (`restaurant`, `location`, `mariage`, `personnels`).
- `20260605_product_reports.sql` : Table de signalement des produits.
- `20260606_seller_reports.sql` : Table de signalement des vendeurs.
- `20260606_social_links.sql` : Ajout des colonnes `facebook_url`, `instagram_url`, `tiktok_url` sur la table `profiles`.
- `20260517_admin_verify_delivery_rpc.sql` : Procédure stockée d'authentification par code de livraison.

---

## Stabilisation du 2026-08-22 (mission post-audit)

- **Paiements vendeur par marché** (`lib/utils/mobile-money.ts`, miroir EXACT de
  `rivendy_app/lib/core/utils/mobile_money_data.dart` — modifier les DEUX ensemble) :
  fin des numéros factices de l'abonnement (`+253 77 00 00 0x`) et des numéros
  Djibouti codés en dur du boost. Modals en 4 étapes à parité app ; sans numéro
  configuré pour un marché → parcours espèces/WhatsApp de l'agence locale,
  jamais de fallback Djibouti silencieux.
- **Crédits boost inclus** : carte « Boost inclus » branchée sur les RPC serveur
  `get_boost_credit_status` / `use_boost_credit` (décompte 100 % serveur,
  produit `active` uniquement).
- **Plan D déployé** : lecteur vidéo sur la fiche produit (`product-video-player.tsx`).
- **Migrations** : `supabase/migrations/` de ce dépôt est ARCHIVÉ (voir son
  README) — propriétaire unique : `rivendy_dashboard/supabase/migrations/`.

## Prochaines Étapes Envisagées
1. **Recherche par image** : Actuellement en mode maquette UI sur Flutter, à évaluer pour implémentation via ML ou API externe.
2. **Page Promo exclusive** : Création d'une page enrichie pour les promotions de la plateforme.
3. **Paiement Mobile** : Intégration ou renforcement des API de paiement mobile local (Djibouti, Comores) si nécessaire à l'avenir.
4. **Parité vidéo restante** : badge vidéo sur les cartes produit, stories vidéo dans `story-viewer.tsx`.

## Sécurisation post-audit du 2026-09-08

- **Produits vendeurs** : création normale et création en lot envoyées en
  `pending`. Le marché actif est persisté avant l'insertion ; le prix vendeur
  est positif et Supabase recalcule la commission et le prix affiché.
- **Édition du prix** : passage obligatoire par
  `seller_update_product_price()` ; un échec RPC ne peut plus produire de faux
  message de réussite.
- **Catégories Rivendy** : `alimentation`, `hotel` et `pharmacie` sont retirées
  des formulaires vendeurs via `RIVENDY_MANAGED_CATEGORY_IDS`, avec contrôle de
  non-régression dans `npm run check`.
- **Commentaires** : likes et signalements passent par les RPC dédiées ; l'état
  des likes est relu depuis Supabase, et le client ne modifie plus directement
  les compteurs.
- **Stock nul** : la fiche produit reste accessible en état « Épuisé », sans
  possibilité d'achat, au lieu de renvoyer une 404.
- **Accessibilité/sécurité HTTP** : modal marché avec sémantique dialog et focus
  confiné, formulaires d'authentification nommés, cibles mobiles de 44 px,
  `unsafe-eval` limité au développement.
- **Validation** : `npm run check` réussi le 2026-09-08 — TypeScript et ESLint
  sans erreur, contrôles catégories/sécurité verts ; 33 avertissements non
  bloquants restent à traiter séparément.
- **Backend partagé** : les migrations propriétaires sont dans
  `rivendy_dashboard/supabase/migrations/20260908_product_insert_hardening.sql`
  et `20260908_product_comments_hardening.sql`. Leur exécution en production a
  été confirmée par le propriétaire le 2026-09-08.

## Parité boutique App/Web du 2026-09-09

- **Source de couverture unique** : l'app Flutter et le site lisent et écrivent
  désormais `profiles.store_banner_url`. La colonne historique
  `store_banner_url_web` ne doit plus être utilisée par le code client.
- **Catalogue unique** : les boutiques web lisent `visible_products`, comme
  Flutter, avec le même filtre `seller_id`, le même marché et les règles serveur
  communes pour statuts, suppressions et précommandes. Les produits vendus ou
  épuisés ne sont plus injectés dans la vitrine publique web.
- **Vidéo de couverture** : le site reprend la vidéo prête des vendeurs
  certifiés lorsque ses colonnes sont lisibles publiquement, avec repli sûr sur
  la photo partagée si Supabase les refuse.
- **Catalogue imprimable** : l'URL du QR code est fournie par le serveur afin
  d'éviter le décalage d'hydratation entre `rivendy.com` et l'origine locale.
- **Validation** : `npm run check` réussi (0 erreur, 33 avertissements
  préexistants), boutique réelle contrôlée localement avec réponse HTTP 200.

## Audit en ligne du 2026-10-09 (branche `fix/site-audit-2026-10-09`)

- **Nom d'un pays dans une phrase** : toujours `inMarket(country)`
  (`lib/utils/market-phrase.ts`) — « aux Comores », « en France », « au
  Sénégal ». `à ${country.name}` donnait « à Comores » partout.
- **Titres** : plus de modèle `%s | Rivendy` dans le layout ; chaque page
  écrit « … — Rivendy » elle-même (le modèle doublait la marque).
- **Ton** : vouvoiement, comme l'app (432 « vous » contre 20 « tu »). Pas de
  « feed » : « accueil » ou « catalogue ». Aucun chiffre non sourcé
  (« #1 », « 3× plus vite », « des milliers d'acheteurs »).
- **Marché du lien** : un `?country=` valide est adopté au premier passage
  (plus de fenêtre « Choisissez votre marché » par-dessus) ; sans compte, il
  remplace aussi le marché mémorisé sur l'accueil. Connecté, le profil reste
  maître (il décide aussi du marché de publication).
- **Catégorie inconnue** dans l'URL de l'accueil : 404, comme un marché inconnu.
- **Lien d'article ou de boutique** (même jour, `feat/marche-article-bandeau`) :
  un premier visiteur sans marché adopte celui de l'article (`MarketHint` →
  `suggestMarket`) au lieu de la fenêtre de choix. Un marché déjà connu
  (profil, choix, lien) n'est jamais remplacé.
- **Connecté sur l'accueil d'un autre marché** : bandeau « Vous consultez la
  Côte d'Ivoire — revenir aux Comores » (`MarketMismatchBanner`, `theMarket()`).

## Police des boutons et champs (2026-10-23, branche `fix/boutons-police`)

- La règle hors couche `button, input, select, textarea { font: inherit; }`
  de `app/site.css` est retirée (CLAUDE.md §9) : les classes de taille, de
  graisse et d'interligne des boutons et champs s'appliquent enfin. Le
  `Button` partagé passe ainsi à 14 px gras (`text-sm font-bold`), comme les
  liens habillés par `buttonVariants`, qui le suivaient déjà.
- Garde : sur écran tactile ou étroit (< 768 px), un champ de saisie reste à
  `max(16px, 1em)` — Safari sur iPhone agrandit la page au toucher d'un champ
  plus petit, et les formulaires sont écrits en `text-sm`/`text-xs`.
- Retirée aussi : la règle de Play
  `.rvp-scope :is(button, input, select, textarea) { font: revert-layer; }`
  (mise en page « application »), qui contournait le même défaut dans Play
  seul ; devenue inutile, elle aurait en plus annulé la garde des 16 px dans
  Play.
- En développement seulement (mode strict de React) : un rechargement vide le
  panier, et « Importer plusieurs photos » de la création de boutique n'ajoute
  rien (compteur hors de la mise à jour d'état). La production n'est pas
  touchée. Tester ces parcours sans recharger, ou photo par photo.
- Captures avant/après et liste des écarts :
  `rivendy-docs/docs/boutons-police/`.

## Refonte de Rivendy Musique du 2026-10-22 (branche `feat/musique-refonte`)

- **Couleurs** : jetons `--rvm-*` dans `app/site.css` (ex-`globals.css`, renommée : voir CLAUDE.md §7) (`:root` + bloc
  `@theme inline` → classes `bg-rvm-accent`, `text-rvm-muted`…). Le vert est
  celui de la marque : `--rvm-accent` = `--rv-primary-light` (#00BFA5, lisible
  sur fond sombre), appuyé = `--rv-primary` (#009688). L'or (`rvm-premium`) est
  RÉSERVÉ à la marque Premium. Jamais de code couleur écrit dans un composant
  Musique. Mêmes valeurs dans l'app (`MusiqueColors`).
- **Coque** : remplacée le même jour par la mise en page « application »
  (section suivante) ; l'ancienne barre latérale et `--rvm-top` n'existent plus.
- **Lecteur** : toujours UN `<audio>` (`music-player-provider.tsx`). La position
  vit dans un contexte à part (`useMusicProgress`) : les listes ne se
  redessinent plus 4 fois par seconde. `playAt`, `toggleMute`, volume gardé
  dans le navigateur.
- **Bibliothèque** (`music-library.tsx`, monté dans `providers.tsx`) : favoris
  (vérifiés par lots, `ensureLikes`), playlists du compte, partage, fenêtre
  « Ajouter à une playlist ». Une action faite sans compte (aimer, enregistrer,
  suivre, ranger, écouter) est gardée le temps de la connexion
  (`music-pending.ts`, 30 min) puis reprise sur la page d'origine ; « écouter »
  demande un geste (bouton « Écouter » proposé), le navigateur l'exige.
- **Pannes** : les lectures du catalogue et de la bibliothèque LÈVENT une
  erreur (`must`) → la page dit « Impossible de charger la musique » avec
  « Réessayer », au lieu d'un catalogue vide.
- `/music/search` → redirige vers `/music/explore` (recherche + genres +
  toutes les sorties). Nouvelles pages : `/music/explore`, `/music/artists`.
- Dev local avec une copie dont `node_modules` est une jonction : Turbopack
  refuse (« points out of the filesystem root ») → `next dev --webpack`.
- **Finitions (même jour, branche `feat/musique-finitions`)** : le lecteur
  affiche la durée VÉRIFIÉE du titre tant que le fichier n'est pas chargé
  (`playerDuration`, `ready` dans `useMusicProgress`) — une file reprise après
  rechargement montrait « 0:00 / 0:00 » ; déplacement inactif avant chargement.
  Accueil : `homeShelves` (jamais deux rangées des mêmes sorties), tuiles
  larges jusqu'à 3 sorties (`ReleaseShelf`), titres populaires + artistes en
  2 colonnes (xl), « Écoutés récemment » seulement s'il montre 2 autres
  sorties, « N° 1 du Rivendy Hit » seulement s'il l'est (`heroHitBadge`).
  Fin de page Musique sombre et compacte (`MusicFooter` ; le grand pied de
  page est masqué par `HideInMusic`). Hauteur du lecteur publiée dans
  `--rvm-player-h` (lecteur flottant des autres pages, file d'attente).
- **Mise en page « application » (même jour, branche `feat/musique-app`)**,
  d'après une vidéo de référence du propriétaire :
  - **Une seule coque** : route group `app/(musique)/layout.tsx` → `MusicShell`
    pour `/music/*` ET `/artist/*` (URL inchangées). Deux layouts séparés
    remontaient toute la coque à chaque passage artiste ↔ musique.
  - **Plein écran** : la page ne défile pas (`html` en `overflow:hidden`) ;
    barre du haut (logo → marketplace, accueil, recherche qui pilote
    `/music/explore?q=`), bibliothèque à gauche (`music-library-panel.tsx`),
    panneau central `#rvm-center` (`@container` : les pages se règlent sur SA
    largeur, pas sur la fenêtre), « En cours de lecture » à droite
    (`music-now-playing.tsx`), lecteur en bas (`MusicPlayerBar`). L'en-tête,
    le pied de page et la bannière de la marketplace sont masqués (`HideInMusic`).
  - **Disposition** (`music-layout.tsx`, localStorage `rivendy_music_layout_v1`) :
    largeurs bornées, le centre garde 420 px (`fitPanels`) ; ≥ 1280 px panneau
    droit dans la page, en dessous en tiroir ; < 768 px bibliothèque dans la
    navigation du bas, mini-lecteur au-dessus. PIÈGE : n'enregistrer que sur un
    geste (`patch`) — un effet d'enregistrement au montage réécrivait les
    valeurs par défaut (effets doublés en dev) et rouvrait le panneau droit.
  - **Bibliothèque** : `fetchLibraryOverview` (une passe : favoris, playlists et
    leurs pochettes, albums, artistes suivis, dernières écoutes) → entrées
    (`libraryEntries`) ; tri/filtre/recherche purs dans `music-logic.ts`.
  - **Collections** (`music-collection.tsx`) : en-tête teinté par la pochette
    (`useCoverTint`, vignette lue en canevas — le stockage répond
    `Access-Control-Allow-Origin: *`), sinon vert dérivé de Rivendy ; barre
    compacte au défilement par écouteur `scroll` (un IntersectionObserver rate
    les sauts d'un coup).
  - **Lecteur** : `source` (sélection d'où part la lecture, gardée avec la
    file), aléatoire au lancement, `clearUpcoming` ; une pause pendant un
    chargement arrête la roue.
  - Vérifié avec un banc d'essai LOCAL (sons WAV, bibliothèque simulée,
    retirés avant commit) : vidéo et captures dans
    `rivendy-docs/docs/musique-refonte/mise-en-page-app/`. Avec un vrai compte :
    à essayer par le propriétaire.
- **Lot « Musique web » (2026-10-23, branche `feat/musique-web`)** : la coque
  réglée sur le web réel (visiteurs, connexion lente, petit catalogue, iPhone).
  - **Visiteur** (ou session pas encore lue) : bibliothèque en rail de 72 px,
    mot d'accueil sur l'accueil. Écouter, liker, enregistrer, suivre, ranger :
    une INVITATION sur place (`music-login-invite.tsx`, petit magasin partagé
    car le lecteur est monté au-dessus de la bibliothèque) au lieu du renvoi
    vers /auth/login ; « Se connecter » garde l'action (`music-pending.ts`).
    Pas d'extrait sans compte (décision du propriétaire, 23/10).
  - **Connexion lente** : `prefetch={false}` sur les liens secondaires (pied de
    page, connexion, notifications, profil, marketplace, Rivendy+, Play) — en
    développement Next ne précharge jamais : à contrôler sur un aperçu.
    Pochettes 480 au lieu de 720 (panneau droit, en-tête de sortie) ; couleur
    d'en-tête calculée au repos du navigateur, jamais en économie de données
    ou en 2G (`lightData`), ni la bannière d'artiste du panneau droit.
  - **Petit catalogue** : `usefulRubrics` (raccourci seulement s'il montre plus
    que l'accueil, Clips seulement s'il existe un clip), `shortcutFill` (rangées
    pleines), pas de « Tout voir » qui répète l'accueil.
  - **Écran d'accueil** : `public/musique.webmanifest` (seulement sur /music et
    /artist, via les métadonnées de `app/(musique)/layout.tsx`, s'ouvre sur
    /music) ; Android renvoie vers l'appli (`prefer_related_applications`).
    `MusicInstallHint` : iPhone « Partager → Sur l'écran d'accueil », Android
    l'appli ; jamais dans une appli intégrée ni une fois installée ; « Plus
    tard » = 30 jours (`installHint`). Essai sur un vrai iPhone : propriétaire.

## Refonte « salle de cinéma » de Rivendy Play du 2026-10-22 (branche `feat/play-cinema`)

- **Couleurs** : jetons `--rvp-*` dans `app/site.css` (`:root` + `@theme inline`
  → `bg-rvp-ground`, `text-rvp-accent`…). Fonds vert profond (#061110), blanc
  cassé (#F3F5F2), accent = vert de la marque (`--rv-primary-light`). L'or
  (`rvp-premium`) est RÉSERVÉ à Rivendy+, comme dans la Musique. Mêmes valeurs
  dans l'app (`PlayColors`). Jamais de code couleur écrit dans un composant Play.
- **Coque** : `app/play/layout.tsx` → `PlayShell` (en-tête sombre : logo →
  marketplace, « PLAY » → accueil Play, Accueil · Films · Séries · Clips ·
  Ma liste, recherche, notifications, compte ; onglets défilants sous 1024 px ;
  pied de page Play). L'en-tête et le pied de page BLANCS de la marketplace
  sont masqués sur /play par `HideInPlay` (`components/layout/hide-in-play.tsx`,
  posé dans `app/layout.tsx`). Aucun prix ni lien d'achat dans la coque : les
  pages `/play/short/…` sont ouvertes depuis l'app Android (règle Google Play).
- **Images** : seulement les VRAIES images du titre. `playImage()` /
  `playSrcSet()` (play-logic) redimensionnent par Supabase avec
  `resize=contain` — voir CLAUDE.md §8. Fond paysage (« Image de fond 16:9 »
  du dashboard, `backdrop_url`) → bannière plein cadre ; sinon l'affiche
  ENTIÈRE, nette, sur son ambiance floutée (jamais recadrée en bandeau : la
  bannière montrait le nez de « Mbayé Trambwé »). La vignette vidéo d'un film
  ou d'un épisode n'est jamais prise pour un fond (vidéo signée = jeton).
  `<picture>` + pixel vide : chaque format ne télécharge que son image.
- **Accueil** : `homeRows()` — chaque titre UNE seule fois (les trois mêmes
  titres revenaient sous Top 10, Nouveautés, Films et Séries) ; jusqu'à
  8 titres, une seule rangée « À l'affiche » ; rangée vide = absente ;
  « Continuer à regarder » seulement avec une vraie position (≥ 30 s, pas
  finie), lien direct vers la reprise, bouton « retirer ». Bannière :
  `heroTitles()` (à la une, puis les plus récents, toujours avec une image),
  sélection MANUELLE (indicateurs, flèches, ← →), aucun défilement automatique.
- **Ma liste** : `PlayListProvider` (`play-list.tsx`) lit `play_list` UNE fois
  pour toutes les cartes ; sans compte, l'ajout est gardé 30 min
  (sessionStorage, identifiant + libellé) et fait au retour de la connexion.
  Le bouton « + » d'une carte est À CÔTÉ du lien (jamais dedans) : il ne lance
  ni la fiche ni la lecture.
- **Recherche** : dans le navigateur, sur le catalogue du marché
  (`searchTitles`, miroir de l'app) : titre, genre, artiste, avec ou sans
  accents. L'adresse suit la saisie (`history.replaceState`, sans recharger).
- **Pannes** : `fetchCatalog` et `fetchMyList` LÈVENT une erreur → « Chargement
  impossible » + « Réessayer », jamais un catalogue vide.
- **Animations** : fondus `.rvp-fade-in` / `.rvp-rise-in` SANS `both` ni
  délai — si l'animation ne tourne pas (onglet en arrière-plan, impression,
  robot), le contenu reste visible. Coupées si l'on réduit les animations.
- Non vérifié (pas de compte de test) : ajout réel à Ma liste, reprise après
  connexion, « Continuer à regarder », lecture.

### Affinage du 2026-10-22 (soir)

- **Bannière = une scène** : l'image occupe toute la bannière. Fond paysage →
  plein cadre, sujet à droite, pas d'affiche devant. Sans fond paysage (les
  titres actuels) → extension floutée et assombrie de l'affiche sur les trois
  quarts droits (`mask-image` vers le texte) et l'affiche entière, nette,
  devant. Hauteur `--rvp-hero` = clamp(420px, 100svh − 290px, 620px) : à
  1366 × 768, « À l'affiche » et le haut des cartes sont dans le premier écran.
- **Cartes paysage** : l'image REMPLIT la miniature 16:9 (affiche cadrée sur
  son tiers haut, `object-[50%_30%]`, à défaut d'un vrai visuel paysage),
  titre et métadonnées DESSOUS ; bouton de lecture vert et « + » posés sur
  l'image, hors du lien de la carte. Colonnes d'après le nombre réel de titres
  (`landscapeCols`).
- **Classification** : `ageLabel` strict — « Tout public » seulement pour la
  valeur `tous` enregistrée (défaut de la colonne `age_rating`), rien pour une
  valeur absente ou inconnue.
- **Pied de page Play** resserré ; sur téléphone, le bandeau de l'application
  réserve lui-même sa place sur les pages Play (le pied de page de la
  marketplace garde sa marge : la barre fixe du panier en dépend).
- **Un seul son à la fois** : la bande-annonce d'une fiche
  (`ProductVideoPlayer`) envoie `MEDIA_PLAY_EVENT` `video:<uid>` — elle met
  la musique en pause, et revient à l'image si la musique ou une autre vidéo
  démarre. (La durée du mini-lecteur pour une file restaurée est traitée par
  les finitions Musique du même jour, `playerDuration`.)

## Mise en page « application » de Play du 2026-10-23 (branche `feat/play-application`)

D'après la maquette du propriétaire (capture `rivendy-play-dashboard-20261023.jpg` ; la
maquette en ligne demande une connexion ChatGPT) : une fenêtre vert profond avec menu
latéral, barre du haut, bannière en carte, panneau de droite et catalogue en vignettes.

- **Coque** (`play-shell.tsx`) : menu Découvrir · Films · Séries · Clips, puis Ma liste
  (nombre de titres du compte) · Récents (/play/history) ; barre du haut : rubrique,
  recherche (Ctrl K / ⌘ K), notifications, compte « Mon espace » (raccourcis, marketplace,
  Musique, déconnexion ; Échap referme) ; fenêtre « À propos de Play » (`<dialog>`
  natif). ≥ 1024 px : la fenêtre ne défile pas (`html[data-world=play]` + hauteur
  100vh puis 100dvh, site.css), seul `#rvp-main` défile. Menu en icônes de 1024 à
  1279 px, complet ensuite ; signature « Nos histoires. Votre écran. » seulement si
  la hauteur d'écran ≥ 861 px. < 1024 px : barre compacte, navigation basse à cinq
  destinations, défilement normal ; le bandeau d'application du site se pose
  au-dessus de la navigation basse sur /play.
- **PIÈGE `#rvp-main` doit rester `relative`** : sinon les éléments positionnés des
  pages (textes `sr-only` compris) prenaient la fenêtre pour repère et allongeaient
  le document (≈ 170 px) alors que la page ne défile pas.
- **PIÈGE `button, input, select, textarea { font: inherit }`** (règle globale HORS
  couche de site.css) : elle l'emportait sur toute classe Tailwind de taille ou de
  graisse posée sur un bouton ou un champ (`text-[13px]`, `font-semibold`… : le
  bouton prenait la police de son parent). D'abord neutralisée dans Play seul
  (`.rvp-scope … { font: revert-layer; }`), puis corrigée pour tout le site le
  même jour (section « Police des boutons et champs », CLAUDE.md §9) : la
  neutralisation propre à Play est retirée.
- **Recherche** (`play-search.tsx`) : UNE saisie partagée par la barre du haut et la
  page (téléphone) ; depuis une autre page, la barre ouvre /play/search dès deux
  lettres en gardant le focus ; l'adresse suit par `history.replaceState` (pas
  d'aller-retour serveur qui ferait perdre des lettres tapées entre-temps).
- **Bannière** (`play-hero.tsx`, `SceneCard`, aussi pour les fiches) : carte réglée
  sur SA largeur (`@container`, texte à côté de l'image dès 576 px). Fond paysage
  (`backdrop_url`) → plein cadre à droite, le rendu de la maquette ; sans fond (cas
  des titres actuels) → l'affiche officielle entière sur son ambiance floutée, même
  adresse d'image (un seul téléchargement). Le visuel paysage de la maquette était
  une image générée (son README) : jamais repris. Pastille `heroBadge` (À la une,
  Nouveau film, sinon le type). Flèches, indicateurs, ← →, glissement du doigt.
- **Panneau de droite** : les favoris du compte (trois premiers de Ma liste) s'il y
  en a ; sinon « À découvrir — Des suggestions à ajouter à votre liste »
  (`suggestionsFor` : jamais un titre déjà dans la liste). Sous la bannière quand la
  place manque.
- **Catalogue** : vignettes `TitleTile` (11:10, affiche cadrée sur son haut, genre,
  titre et durée posés dessus) ; « À l'affiche » filtrable Tout / Films / Séries
  (`kindFilters`, seulement si les deux types existent) ; carte « L'espace des
  talents » → Clips s'il y en a, sinon les artistes de Rivendy Musique
  (`talentsTarget`). « Continuer à regarder » inchangé sur le fond : une VRAIE
  position seulement.
- Couleurs nouvelles : `--rvp-frame`, `--rvp-side`, `--rvp-card`, `--rvp-edge`,
  `--rvp-deep`, `--rvp-sage` (relevées sur la maquette) ; l'accent reste le vert de
  la marque (`--rv-primary-light`), pas le vert menthe de la maquette.
- Vérifié localement : visiteur de 390 à 1920 px (aucun débordement, aucune erreur
  console), compte SIMULÉ dans le navigateur (session factice, lectures du compte
  servies localement, écritures interceptées, rien envoyé au serveur), clavier,
  pannes simulées. Avec un vrai compte : à essayer par le propriétaire.

## Refonte « Emerald Cinema » de Play du 2026-10-24 (branche `feat/play-emerald`)

Brief du propriétaire (« RIVENDY PLAY — EMERALD CINEMA ») et nouvelle maquette de
référence : passer d'un tableau de bord à une salle de cinéma, sans rien changer aux
données, aux routes, au compte, à la lecture ni à Supabase.

- **Jetons** (`app/site.css`) : palette du brief — fonds #020907 / #04120D, surfaces
  #071A14 / #0A211A, vert Play #00D6A3 (accent), #47FF7A et #6DFF45 réservés aux
  halos. « Texte discret » du brief (#688078) trop faible sur les cartes (4:1) :
  gardé en `--rvp-faint` pour le décor, `--rvp-muted` éclairci (#7E968D, 5,2:1).
  Rayons, ombres, courbe et durées (`--rvp-fast/base/slow`, `ease-rvp`) dans
  `@theme` ; recettes de classes dans `features/play/play-theme.ts`. Effets
  (atmosphère, grain, verre, voiles de bannière, squelettes, fondus, parallaxe liée
  au défilement) : classes `rvp-*` de site.css, coupées si l'on réduit les animations.
  Anciens jetons `--rvp-card/side/deep/panel/sage` supprimés.
- **Polices** : Urbanist (titres) et Inter (interface), celles de l'application,
  chargées par `app/play/layout.tsx` (next/font, sur /play seulement ; Inter sans
  préchargement pour laisser passer l'image de la bannière).
- **Composants** (un fichier par rôle) : `play-shell` (coque, ambiance de page,
  navigation basse), `play-sidebar`, `play-header`, `play-footer` (+ « À propos »),
  `play-brand`, `play-hero` (CinematicScene, CinematicHero, HeroMetadata, PlayButton),
  `play-cards` (MediaCard 4:3, ResumeCard et ClipCard 16:9, PosterCard), `play-talents`
  (illustration SVG dessinée : projecteur, micro, foule — aucune photo inventée),
  `play-home` (accueil), `play-hooks` (positions, Ma liste), `play-ui` (MediaRow,
  grilles, états), `play-views` (catalogues, fiches, Ma liste, Récents, recherche).
- **Bannière « key art »** : l'affiche n'est plus dans une carte à droite ; elle EST la
  bannière — grande, cadrée sur son haut (visages), fondue vers le texte et le bas,
  avec son extension floutée derrière et un halo émeraude. Fond paysage
  (`backdrop_url`) → plein cadre. Une SEULE image téléchargée : même adresse et mêmes
  `sizes` pour le décor, l'image nette et l'ambiance de la page (`usePageBackdrop`).
  Taille du titre d'après sa longueur (`heroTitleSize`). Téléphone : affiche en 4:5
  d'un bord à l'autre, sous la barre du haut transparente.
- **Coque** : menu flottant (complet ≥ 1280 px, en icônes de 768 à 1279 px — la
  tablette a désormais le menu au lieu de la navigation basse), barre du haut
  transparente puis en verre au défilement, ambiance de page (image du titre floutée
  derrière le haut de l'accueil, des fiches, des catalogues et de Ma liste, mêmes
  tailles que l'image affichée : aucun téléchargement de plus).
- **Accueil** : bannière + « À découvrir » (verre) ; « Continuer à regarder » en cartes
  16:9 (reprise directe, barre d'avancement) ; « À l'affiche » 4:3 (rangée glissante
  sur téléphone, trois colonnes ensuite) avec « L'espace des talents » dans la colonne
  du panneau, même haut et même bas que les cartes.
- **Pas de « Rivendy Play Original »** : aucune colonne ne dit qu'un titre est une
  production originale ; la bannière dit la raison réelle (« À la une », « Nouveau
  film », le type). Une section Originals demanderait une colonne (zone protégée).
- Vérifié (Chromium sans fenêtre, de 390 à 1920 px) : aucun débordement, 0 erreur
  console, parcours carrousel / filtres / Ctrl K / recherche / « À propos » / « + »
  sans compte / panne / chargement, tabulation (contour vert 26/26), animations
  réduites ; compte SIMULÉ (reprise, épisode en cours, favoris, compteur, menu,
  ajout et retrait — écritures interceptées, rien envoyé). Marketplace et Musique
  inchangées. `npm run check` OK (play 25/25).

*Dernière mise à jour : 24 octobre 2026 (refonte « Emerald Cinema » de Play)*
