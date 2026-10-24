@MEMORY.md

---

# Pièges de ce dépôt — à lire avant d'écrire

## 1. Ce site doit rester en parité avec l'app Flutter

`rivendy_web` n'est pas un produit autonome : c'est la version web d'une
application mobile existante (`../rivendy_app`), et les deux tapent dans **le
même Supabase**. Toute logique métier ajoutée ici doit exister à l'identique
côté app, sinon un acheteur obtient un prix ou un comportement différent selon
le canal.

Cas déjà rencontré : un acheteur comorien aurait payé 500 à 3 000 KMF de
livraison depuis l'app et **0** depuis le web, pour le même produit.

**Avant d'implémenter une règle métier ici**, vérifier son équivalent dans
`../rivendy_app/lib/` et lire `../rivendy_app/PROTECTED_ZONES.md`.

## 2. Ne JAMAIS utiliser un libellé d'affichage comme clé de recherche

`categoryLabel()` (`lib/utils/format.ts`) renvoie des libellés d'**interface** :
« Artisanat local », « Supermarché ». La base stocke « Artisanat »,
« Alimentation ». Les réutiliser dans un `.eq()` ne remonte aucune ligne — et
échoue **silencieusement**, en retombant sur une valeur par défaut.

Les correspondances destinées à la base vivent dans
`lib/utils/commission.ts` (`COMMISSION_CATEGORY_LABELS`) et
`lib/utils/delivery-location.ts`.

⚠️ `commission_rules.category` contient des **libellés accentués**
(« Électronique », « Bébé & Enfants »). Les clés techniques camelCase ont été
supprimées de cette table le 2026-07-05 : les utiliser ne renvoie rien.

## 3. Grille de commission — 4 sources à modifier ensemble

`lib/utils/commission.ts` → `REFERENCE_GRID` n'est qu'**une** des quatre copies
de la grille. Modifier un taux ici seulement crée une divergence invisible entre
le web, l'app et le dashboard. Voir `../rivendy_app/PROTECTED_ZONES.md` §1.4.

**Depuis le 2026-10-02, le MONTANT suit la grille par prix** : `PRICE_TIERS` +
`commissionForSellerPrice()` (6 / 8 / 10 % par portion, seuils et pas
d'arrondi par marché, calcul en entiers identique à la fonction SQL
`commission_amount_for`). `REFERENCE_GRID` ne dit plus que si une catégorie
est exonérée (0). `scripts/check-commission-grid.mjs`, lancé par
`npm run check`, échoue si `PRICE_TIERS` s'écarte du tableau validé — ne pas
le contourner.

**Invariant :** `price = seller_price + commission_amount`. La commission
s'AJOUTE au prix vendeur, elle ne s'en déduit jamais.

## 4. Livraison — bascule par marché

Le parcours Région→Localité→Quartier ne s'active **que pour `KM`**
(`isSupportedMarket()` dans `lib/utils/delivery-location.ts`). Les 15 autres
marchés conservent le champ texte libre historique, car leurs zones ne sont pas
en base. Ajouter un marché suppose d'abord de seeder ses régions/localités.

`normalizeLocationName()` est le **miroir exact** de la version Dart et de la
fonction SQL `normalize_location_name()`. Toute divergence rend des localités
introuvables à la recherche.

## 5. Variables d'environnement Vercel

`lib/supabase/client.ts` **lève une exception au build** si
`NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` manquent. C'est
volontaire — mieux vaut un build rouge qu'un site déployé silencieusement cassé.

⚠️ Ces variables doivent être définies pour **Production ET Preview**. Une
variable définie pour Production seule fait échouer tous les déploiements de
Pull Request (rencontré le 2026-07-26).

`NEXT_PUBLIC_*` est inlinée **au build** : changer une valeur exige un
redéploiement, pas seulement un redémarrage.

## 6. Limite de taille Vercel

Vercel rejette toute requête dont le corps dépasse **4,5 Mo**, avant même
d'atteindre une route (`413 Request Entity Too Large`). Ce dépôt n'a AUCUNE
route `app/api/` : les uploads partent directement du navigateur vers
Supabase Storage — compresser les images côté client (canvas JPEG) et ne
jamais faire transiter un fichier par une route Vercel.

---

## 7. Feuille de style : Vercel peut servir l'ANCIEN contenu

Le 2026-10-22 (refonte Musique), la production construite avec « Restored build
cache » a servi l'ancien `app/globals.css` : les classes nouvelles du code
étaient bien générées, mais ni les variables `:root` ni le bloc `@theme`
ajoutés — la Musique s'affichait sans son fond sombre. Même piège vécu sur le
dashboard le 2026-10-09. Contournement appliqué : la feuille a changé de nom
(`app/site.css`). **Après tout changement de la feuille, vérifier la feuille
SERVIE** (`curl` de la page → fichier `.css` → `grep` d'une règle nouvelle ;
pour un aperçu protégé : `vercel curl`). Si cela se reproduit : nouveau nom de
fichier, ou variable `VERCEL_FORCE_NO_BUILD_CACHE=1` sur le projet Vercel
(réglage du propriétaire).

## 8. Vignettes Supabase : `resize=contain`, sinon l'image est RECADRÉE

`/storage/v1/render/image/…?width=480` seul, en mode par défaut (`cover`),
garde la HAUTEUR d'origine et recadre : une affiche 1365×2048 revenait en
480×2048, une pochette carrée de 1329 px en 320×1329 — affichées zoomées sur
leur centre (constaté en production le 2026-10-22, Musique comprise). Toute
adresse de vignette porte donc `resize=contain` (`thumbUrl` de la Musique,
`playImage` de Play). Vérifier une vignette = ouvrir son adresse et lire ses
dimensions, jamais supposer.

## 9. `app/site.css` : une règle hors couche passe devant TOUTES les classes

Tailwind v4 range ses styles dans des couches CSS (`base`, `utilities`…). Une
règle écrite dans `app/site.css` hors de tout `@layer` l'emporte sur toutes les
classes, quelle que soit leur précision. Jusqu'au 2026-10-23,
`button, input, select, textarea { font: inherit; }` (hors couche) annulait
`text-sm`, `font-bold`, `leading-*`… sur tous les boutons et champs : un bouton
prenait la taille et la graisse de son parent (« Ajouter au panier » en 16 px
normal au lieu de 11 px gras), alors qu'un lien habillé en bouton suivait sa
classe. La base de Tailwind fait déjà ce `font: inherit`, dans sa couche : ne
jamais le réécrire hors couche. Seule règle hors couche voulue pour la police :
sur écran tactile ou étroit (< 768 px), un champ de saisie jamais sous 16 px
(sinon Safari sur iPhone agrandit la page au toucher du champ).

## 10. `cn()` (tailwind-merge) retire un interligne placé AVANT une taille

`cn("leading-[0.95]", "text-[clamp(…)]")` ne garde pas l'interligne :
tailwind-merge considère qu'une classe de taille de police (`text-…`) remplace
tout `leading-…` qui la précède (les tailles nommées de Tailwind fixent aussi
l'interligne). Vécu le 2026-10-24 : le grand titre de la bannière de Play
s'affichait en interligne 1,5 au lieu de 0,95. Dans un `cn()` — même à
l'intérieur d'une seule chaîne —, écrire l'interligne APRÈS la taille. (Dans un
`className` simple, sans `cn`, rien n'est retiré.)

## Vérifications avant de livrer

`npx tsc --noEmit` → **0 erreur** (obligatoire)
`npm run lint` → **0 problème** depuis le 2026-10-08 (33 avertissements levés :
imports morts, navigations `window.location`). Toute nouvelle alerte est à
corriger, pas à absorber.

**Ne pas lancer `npm run build`** sans demande explicite du propriétaire.

⚠️ `npm run build` modifie `next-env.d.ts` (chemin de types dev → prod). C'est un
artefact, ne pas le commiter.
