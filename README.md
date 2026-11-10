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
- `TEMPLATES.CHEVILLE` : configuration clinique sans données patient. Les qualités, tests, critères de sortie, sous-types, mémos et options de séance alimentent le moteur commun. Ajouter un template au registre permet de le proposer dans le formulaire. Le registre contient désormais CHEVILLE et GENOU (hors LCA).

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

## Convention des qualités

Utiliser **Endurance de force** dans tous les templates présents et futurs, notamment LCA, Tendons MI et Pubalgie. L’identifiant historique `capacity` reste stable ; ce changement d’intitulé ne réécrit aucune donnée des cas CHEVILLE.

## GENOU et mesures configurables

Le template GENOU propose six qualités, des profils cliniques et leurs précautions. Le profil ne change aucun statut. Les mesures détaillées sont accessibles dans **Qualités → Détail → + Mesure**. Chaque enregistrement forme un instantané longitudinal daté dans `case.measurements` (extension facultative de la base v2). Les valeurs chiffrées restent dans le détail ; la synthèse montre les sous-composantes A/B et les derniers éléments fonctionnels. Les séances et pivots existants restent indépendants et éditables.

Les configurations `fields`, `components`, `bilateral`, `aggregate`, `shortName` pilotent le formulaire et le rendu commun : aucun écran spécifique GENOU. Les futurs templates peuvent réutiliser ces blocs. Chaque mesure peut être corrigée sans changer son identifiant ou sa date, ou supprimée après confirmation.

Pour Force MI et Endurance de force, le dernier instantané détermine le statut automatique : A prioritaire, puis B, puis C, sinon D. Un clic manuel A/B/C/D active un override persistant dans `qualityOverrides`, même si la lettre sélectionnée est déjà affichée. **Revenir au statut automatique** désactive cet override. Modifier ou supprimer une mesure recalcule le statut uniquement si le mode automatique est actif. Les autres qualités gardent un statut clinique manuel. Aucun statut n’est déduit d’un seuil numérique.

Le LSI est calculé à l’affichage à partir du côté atteint / côté controlatéral × 100 ; il peut dépasser 100 %. Une référence vide, nulle ou invalide ne produit aucun LSI. Les unités et le protocole doivent être cohérents, notamment pour le Single-Leg Bridge. Les normes, percentiles, références individuelles et cut-offs documentés restent facultatifs et sans règle automatique arbitraire. La douleur, l’irritabilité et l’épanchement sont des modificateurs, jamais une septième qualité.

Test complémentaire : `node tests/genou.cjs` (mêmes `APP_URL` et `CHROMIUM_PATH` que les autres tests). Il couvre les six qualités, les LSI, les agrégations et overrides, les profils, le running répété, la persistance, l’édition/suppression des mesures et la conservation d’un cas CHEVILLE préexistant.
