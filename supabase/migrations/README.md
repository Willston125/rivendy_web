# ⚠️ DOSSIER ARCHIVÉ — ne plus rien ajouter ici

Le **propriétaire unique** des migrations Supabase est :

```
rivendy_dashboard/supabase/migrations/
```

Décision de l'étape 10 de la mission stabilisation (2026-08-21) : ce dossier
avait créé un double propriétaire divergent de `product_reports`
(`20260605_product_reports.sql` vs `20260523_product_moderation.sql` côté
dashboard), réconcilié par
`rivendy_dashboard/supabase/migrations/20260822_product_reports_reconcile.sql`
(appliquée en production le 2026-08-21).

Les 7 fichiers présents documentent l'historique déjà appliqué — ils ne
doivent être ni modifiés ni rejoués. Toute nouvelle évolution de schéma se
fait dans le dépôt dashboard, avec un fichier propriétaire unique par
fonction SQL (piège `42725`).
