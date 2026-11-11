# Cockpit Clinique

Application autonome HTML/CSS/JavaScript, sans backend ni dépendance applicative. Templates disponibles : CHEVILLE et GENOU (hors LCA). Aucun autre template n’est livré.

## Démarrage et parcours

Depuis le dépôt : `python3 -m http.server 8000 --bind 127.0.0.1`.

L’accueil montre les patients ayant un cas actif. **Tous / Archives** donne aussi accès aux patients sans cas actif. Un patient peut avoir plusieurs épisodes indépendants ; créer un patient ne crée aucun cockpit. Un cas peut être archivé depuis son bloc d’identification, après confirmation, et réactivé depuis Modifier.

La synthèse montre le patient, le cas, l’objectif, la fonction cible, le profil compact, la carte des six qualités, les principales sous-composantes A/B, la dernière exposition et le dernier changement de statut. Les précautions complètes du profil sont dépliables. Les KPI de comptage ne figurent plus dans la synthèse.

## Mesure → interprétation → carte clinique

**Tests pivots** et **Qualités → Détail** utilisent les mêmes enregistrements dans `case.pivots` et le même formulaire. Les séances restent séparées. Les mesures saisies depuis Qualités apparaissent dans l’historique des pivots ; celles saisies depuis les pivots apparaissent dans le détail de la qualité. Il n’y a pas de seconde saisie de statut.

Choisir une qualité puis un test, saisir les valeurs et choisir une décision A/B/C/D. Le formulaire calcule le LSI côté atteint / côté controlatéral × 100 ; il peut dépasser 100 %. Une référence vide ou nulle ne produit aucun LSI. Aucun seuil clinique numérique n’est inventé. Sans règle documentée, le formulaire affiche **Pas de cut-off validé disponible — décision clinique requise**. Les références facultatives restent dépliables.

Force MI et Endurance de force ont des sous-composantes cliniques avec statut propre. Le moteur reconstruit leur dernier état à partir des pivots et agrège A prioritaire, puis B, puis C ; D est ignoré sauf si tout est D. Les composantes d’un ancien instantané groupé restent éditables ensemble. Les métriques SSC ont uniquement des valeurs et références, avec **un seul statut clinique global SSC**. Les anciens sous-statuts SSC restent conservés dans les données historiques mais ne sont plus proposés ou utilisés comme sous-qualités.

Le global composé reste modifiable manuellement dans Qualités. Cet override reste temporaire : valider un nouveau pivot pour cette qualité composée réactive le calcul global à partir des sous-composantes actualisées. Le clinicien peut ensuite appliquer un nouvel override. Un pivot d’une autre qualité ne le réinitialise pas. **Revenir au statut automatique** permet aussi de le lever immédiatement. Les autres qualités prennent la dernière décision clinique explicite enregistrée. La carte `qualityStatus` est la projection courante de ces décisions, avec historique de ses changements ; aucun statut n’est déduit automatiquement du profil ou d’un LSI.

Les pivots et séances sont modifiables et supprimables avec confirmation. L’édition conserve identifiant et date ; les séances conservent aussi leur numéro. Aucune renumérotation automatique de l’historique. L’édition d’un pivot recalcule les qualités affectées. Après suppression, le moteur utilise la dernière décision restante, sans effacer l’historique de statut. Si aucune décision ne permet de recalculer, la dernière lettre est conservée et explicitement signalée **à réévaluer** ; aucun nouveau statut n’est inventé.

## Profils et configuration générique

Les profils définissent les qualités et tests recommandés et une courte vigilance. Les recommandations se basent sur les profils GENOU et les repères CHEVILLE existants. Les autres possibilités restent accessibles par **+ Autre qualité** et **+ Autre mesure**. Un test ajouté manuellement reste proposé dans ce cas (`profileExtras`). Changer le profil ne supprime ni test déjà renseigné ni données historiques et ne change aucun statut.

`TEMPLATES` contient uniquement des configurations sans données patient. Les propriétés `fields`, `components`, `kind: subcomponent/metric`, `testTargets`, `testFields`, `aggregate`, `bilateral`, `profiles` et `shortName` alimentent le formulaire commun. Ajouter un template ou un profil consiste principalement à ajouter une configuration. Une future règle documentée peut fournir `quality.interpretation = { reference, propose(data) }` : sa proposition A/B/C/D est affichée, conservée avec la référence et reste soumise au choix du clinicien. Aucun template livré ne définit actuellement de règle numérique automatique.

Utiliser **Endurance de force** pour tous les templates présents et futurs, notamment LCA, Tendons MI et Pubalgie. L’identifiant historique `capacity` reste stable.

## Stockage et migration version 3

La clé localStorage reste `cockpit_clinique_v1_data`.

- `patients` : identité minimale (`id`, `name`, `note`, dates), indépendante de la pathologie.
- `cases` : épisode lié par `patientId` et `templateId`, titre, côté, sous-type, contexte, objectif, fonction cible, contraintes, statut `active/archived` et dates.
- `case.pivots` : source commune des mesures et interprétations, avec valeurs, composantes éventuelles, séance facultative, commentaire, statut proposé/final et référence utilisée.
- `qualityStatus`, `qualityOverrides`, `decisionUnresolved` et `statusHistory` : projection actuelle, override, signal de réévaluation et historique conservé.

La migration v1 crée une identité Patient et un Cas CHEVILLE par ancien patient et conserve l’objet source dans `legacySnapshot`. La migration v2→v3 rassemble les anciennes `measurements` dans les pivots sans modifier leurs valeurs ou dates ; les identifiants sont conservés sauf collision, auquel cas un identifiant préfixé est utilisé et `originalMeasurementId` conserve l’identifiant initial. Une copie exacte des anciens instantanés demeure dans `legacyMeasurements`, archive jamais utilisée comme source clinique active. Les pivots préexistants, séances, statuts et historiques ne sont pas réinterprétés lors de la migration.

Avant migration, une copie de la chaîne locale complète est enregistrée sous `cockpit_clinique_v1_data_backup_migration_*`. La migration est idempotente. Si lecture, validation ou écriture échoue, la base originale n’est pas remplacée par une base vide. Les sauvegardes locales et archives ne sont pas supprimées automatiquement.

L’export JSON contient toute la base v3, archives comprises. La restauration accepte v1/v2/v3, valide avant remplacement, demande confirmation et conserve la base actuelle sous une clé `cockpit_clinique_v1_data_backup_import_*`. Les copies locales sont consultables dans les outils de stockage du navigateur ; elles restent sur l’appareil et ne remplacent pas un export conservé ailleurs. Les données locales ne sont pas chiffrées par l’application.

## Vérification

Avec Node, Playwright et Chromium disponibles dans l’environnement de développement, démarrer le serveur puis exécuter :

```sh
node tests/smoke.cjs
node tests/longitudinal.cjs
node tests/genou.cjs
node tests/workflow.cjs
node tests/migration.cjs
```

`APP_URL` permet de changer l’URL du serveur et `CHROMIUM_PATH` l’exécutable Chromium. Les tests utilisent des contextes navigateur jetables et des données fictives. Ils couvrent patients/cas, séances, pivots, profils et ajouts, décisions et replay après édition/suppression, agrégation et override, LSI, métriques SSC sans sous-statuts, exposition répétée, persistance, export/restauration, migration depuis une base v2 produite par l’ancienne application, sauvegarde brute et conservation des données CHEVILLE. Le test de migration lit le commit historique `51249a2`, qui doit être présent dans le clone.
