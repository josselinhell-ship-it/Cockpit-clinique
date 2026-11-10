# Cockpit Clinique

Application autonome HTML/CSS/JavaScript, sans backend ni dépendance applicative.

## Démarrage

Depuis le dépôt : `python3 -m http.server 8000 --bind 127.0.0.1`.

## Modèle local, version 2

La clé localStorage reste `cockpit_clinique_v1_data` pour retrouver les installations existantes.

- `patients` : identité (`id`, `name`, `note`, dates), indépendante de la pathologie.
- `cases` : épisode lié par `patientId`, avec `templateId`, titre, côté, sous-type, contexte, objectif, fonction cible, contraintes et dates.
- `case.status` : `active` ou `archived` ; aucun archivage implicite du patient.
- `case.qualityStatus` : valeurs A/B/C/D par identifiant de qualité. L’historique, les séances et les pivots (avec leurs décisions cliniques) appartiennent au cas.
- `TEMPLATES.CHEVILLE` : configuration clinique sans données patient. Les qualités, tests, critères de sortie, sous-types, mémos et options de séance alimentent le moteur commun. Ajouter un template au registre permet de le proposer dans le formulaire ; aucun autre template clinique n’est encore livré.

L’accueil affiche uniquement les patients ayant un cas actif. « Tous / Archives » donne accès à tous les patients, y compris ceux sans cas, afin de créer de nouveaux épisodes. La fiche patient sépare cas actifs et archivés. Créer un patient ne crée aucun cas.

## Migration et sauvegardes

Au premier chargement d’une base v1, chaque ancien patient devient une identité et un cas CHEVILLE. Les identifiants patients, données cliniques, historiques, séances, pivots et état d’archivage sont conservés. Les côtés inconnus restent non renseignés. Les identifiants de cas migrés sont déterministes. Une base v2 n’est pas remigrée.

Avant d’écrire la migration, une copie exacte de la chaîne originale est enregistrée sous une clé `cockpit_clinique_v1_data_backup_migration_*`. Une copie complète de l’objet historique est aussi conservée dans `legacySnapshot`, y compris ses champs supplémentaires. Ces copies ne sont jamais supprimées automatiquement. Si lecture, validation ou écriture échoue, le chargement est bloqué et la base initiale n’est pas remplacée par une base vide.

L’export JSON contient la base v2 entière. La restauration accepte v1 et v2, valide avant remplacement, demande confirmation et conserve la base courante sous une clé `cockpit_clinique_v1_data_backup_import_*`. Les copies locales sont consultables via les outils de stockage du navigateur ; elles restent sur cet appareil et ne remplacent pas un export JSON conservé ailleurs. Les données et sauvegardes locales ne sont pas chiffrées par l’application.

## Vérification

Avec Node, Playwright et Chromium disponibles dans l’environnement de développement, démarrer le serveur ci-dessus puis exécuter `node tests/smoke.cjs`. `CHROMIUM_PATH` peut indiquer un autre exécutable Chromium.

Le test utilise un contexte navigateur jetable et des patients fictifs : création patient/cas, isolation de deux épisodes, A/B/C/D et historique, séance, pivot, fermeture/réouverture, archivage, export et restauration v1/v2, migration idempotente, conservation des champs historiques, rejet des imports invalides et largeurs tactiles 390/820/1180 px.

Les séances et pivots disposent d’actions Modifier / Supprimer dans leurs historiques. Les éditions conservent leurs identifiants et dates ; les séances conservent également leur numéro. La suppression nécessite une confirmation et ne renumérote pas l’historique. L’archivage confirmé est accessible directement dans le bloc d’identification du cas et reste disponible dans Modifier.

Test complémentaire : `node tests/longitudinal.cjs`. Il vérifie les formulaires préremplis, les corrections sans doublons, les suppressions ciblées, les confirmations annulées/acceptées, l’archivage direct, l’isolation des cas et la persistance après réouverture. Pour utiliser un autre port, définir `APP_URL` pour les deux scripts de test.
