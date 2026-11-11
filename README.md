# Cockpit Clinique

Application autonome HTML/CSS/JavaScript, sans backend ni dépendance applicative. Templates disponibles : CHEVILLE, GENOU (hors LCA) et LCA.

## Démarrage et parcours

Depuis le dépôt : `python3 -m http.server 8000 --bind 127.0.0.1`.

L’accueil montre les patients ayant un cas actif. **Tous / Archives** donne aussi accès aux patients sans cas actif. Un patient peut avoir plusieurs épisodes indépendants ; créer un patient ne crée aucun cockpit. Un cas peut être archivé depuis son bloc d’identification, après confirmation, et réactivé depuis Modifier.

La synthèse montre le patient, le cas, l’objectif, la fonction cible, le profil compact, la carte des six qualités, les principales sous-composantes A/B, la dernière exposition et le dernier changement de statut. Les précautions complètes du profil sont dépliables. Les KPI de comptage ne figurent plus dans la synthèse.

## Mesure → interprétation → carte clinique

**Tests pivots** et **Qualités → Détail** utilisent les mêmes enregistrements dans `case.pivots` et le même formulaire. Les séances restent séparées. Les mesures saisies depuis Qualités apparaissent dans l’historique des pivots ; celles saisies depuis les pivots apparaissent dans le détail de la qualité. Il n’y a pas de seconde saisie de statut.

Choisir une qualité puis un test, saisir les valeurs et choisir une décision A/B/C/D. Le formulaire calcule le LSI côté atteint / côté controlatéral × 100 ; il peut dépasser 100 %. Une référence vide ou nulle ne produit aucun LSI. Aucun seuil clinique numérique n’est inventé. Sans règle documentée, le formulaire affiche **Pas de cut-off validé disponible — décision clinique requise**. Les références facultatives restent dépliables.

Force MI et Endurance de force ont des sous-composantes cliniques avec statut propre. Le moteur reconstruit leur dernier état à partir des pivots et agrège A prioritaire, puis B, puis C ; D est ignoré sauf si tout est D. Les composantes d’un ancien instantané groupé restent éditables ensemble. Les métriques SSC ont uniquement des valeurs et références, avec **un seul statut clinique global SSC**. Les anciens sous-statuts SSC restent conservés dans les données historiques mais ne sont plus proposés ou utilisés comme sous-qualités.

Le global composé reste modifiable manuellement dans Qualités. Cet override reste temporaire : valider un pivot nouveau ou modifié pour cette qualité composée réactive le calcul global à partir des sous-composantes actualisées. Le clinicien peut ensuite appliquer un nouvel override. Un pivot d’une autre qualité ne le réinitialise pas. **Revenir au statut automatique** permet aussi de le lever immédiatement. Les autres qualités prennent la dernière décision clinique explicite enregistrée. La carte `qualityStatus` est la projection courante de ces décisions, avec historique de ses changements ; aucun statut n’est déduit automatiquement du profil ou d’un LSI.

Les pivots et séances sont modifiables et supprimables avec confirmation. L’édition conserve identifiant et date ; les séances conservent aussi leur numéro. Aucune renumérotation automatique de l’historique. L’édition d’un pivot recalcule les qualités affectées. Après suppression, le moteur utilise la dernière décision restante, sans effacer l’historique de statut. Si aucune décision ne permet de recalculer, la dernière lettre est conservée et explicitement signalée **à réévaluer** ; aucun nouveau statut n’est inventé.

## Profils et configuration générique

Les profils définissent les qualités et tests recommandés et une courte vigilance. Les recommandations se basent sur les profils GENOU et les repères CHEVILLE existants. Les autres possibilités restent accessibles par **+ Autre qualité** et **+ Autre mesure**. Un test ajouté manuellement reste proposé dans ce cas (`profileExtras`). Changer le profil ne supprime ni test déjà renseigné ni données historiques et ne change aucun statut.

`TEMPLATES` contient uniquement des configurations sans données patient. Les propriétés `fields`, `components`, `kind: subcomponent/metric`, `testTargets`, `testFields`, `aggregate`, `bilateral`, `profiles` et `shortName` alimentent le formulaire commun. Ajouter un template ou un profil consiste principalement à ajouter une configuration. Une future règle documentée peut fournir `quality.interpretation = { reference, propose(data) }` : sa proposition A/B/C/D est affichée, conservée avec la référence et reste soumise au choix du clinicien. Aucun template livré ne définit actuellement de règle numérique automatique.

Utiliser **Endurance de force** pour tous les templates présents et futurs, notamment LCA, Tendons MI et Pubalgie. L’identifiant historique `capacity` reste stable.

## Stockage et migration version 4

La clé localStorage reste `cockpit_clinique_v1_data`.

- `patients` : identité minimale (`id`, `name`, `note`, dates), indépendante de la pathologie.
- `cases` : épisode lié par `patientId` et `templateId`, titre, côté, sous-type, contexte, objectif, fonction cible, contraintes, statut `active/archived` et dates.
- `case.pivots` : source commune des mesures et interprétations, avec valeurs, composantes éventuelles, séance facultative, commentaire, statut proposé/final et référence utilisée.
- `qualityStatus`, `qualityOverrides`, `decisionUnresolved` et `statusHistory` : projection actuelle, override, signal de réévaluation et historique conservé.

La migration v1 crée une identité Patient et un Cas CHEVILLE par ancien patient et conserve l’objet source dans `legacySnapshot`. La migration v2→v3 rassemble les anciennes `measurements` dans les pivots sans modifier leurs valeurs ou dates ; les identifiants sont conservés sauf collision, auquel cas un identifiant préfixé est utilisé et `originalMeasurementId` conserve l’identifiant initial. Une copie exacte des anciens instantanés demeure dans `legacyMeasurements`, archive jamais utilisée comme source clinique active. Les pivots préexistants, séances, statuts et historiques ne sont pas réinterprétés lors de la migration.

Avant migration, une copie de la chaîne locale complète est enregistrée sous `cockpit_clinique_v1_data_backup_migration_*`. La migration est idempotente. Si lecture, validation ou écriture échoue, la base originale n’est pas remplacée par une base vide. Les sauvegardes locales et archives ne sont pas supprimées automatiquement.

L’export JSON contient toute la base v4, archives comprises. La restauration accepte v1/v2/v3/v4, valide avant remplacement, demande confirmation et conserve la base actuelle sous une clé `cockpit_clinique_v1_data_backup_import_*`. Les copies locales sont consultables dans les outils de stockage du navigateur ; elles restent sur l’appareil et ne remplacent pas un export conservé ailleurs. Les données locales ne sont pas chiffrées par l’application.

## Vérification

Avec Node, Playwright et Chromium disponibles dans l’environnement de développement, démarrer le serveur puis exécuter :

```sh
node tests/smoke.cjs
node tests/longitudinal.cjs
node tests/genou.cjs
node tests/workflow.cjs
node tests/migration.cjs
node tests/lca.cjs
```

`APP_URL` permet de changer l’URL du serveur et `CHROMIUM_PATH` l’exécutable Chromium. Les tests utilisent des contextes navigateur jetables et des données fictives. Ils couvrent patients/cas, séances, pivots, profils et ajouts, décisions et replay après édition/suppression, agrégation et override, LSI, métriques SSC sans sous-statuts, exposition répétée, persistance, export/restauration, migration depuis une base v2 produite par l’ancienne application, sauvegarde brute et conservation des données CHEVILLE. Le test de migration lit le commit historique `51249a2`, qui doit être présent dans le clone.

## LCA : quatre phases critériées

Le template LCA réutilise le moteur des six qualités et des pivots. Il ajoute des champs de cas configurés (côté opéré, date, chirurgien, greffon, gestes associés multiples, restrictions et protocole), puis quatre phases exactement : récupération postopératoire précoce, reconstruction des capacités, Return to Run / impacts, Return to Sport / Performance. Les sous-jalons sportifs restent des expositions en phase 4.

Les seuils explicitement fournis pour les critères sont distincts des décisions A/B/C/D : un LSI de 84 % peut valider le critère quadriceps de phase 2 tout en gardant une interprétation clinique B. Le LSI seul ne valide ni les valeurs absolues, ni la préparation au sport. Les critères qualitatifs se renseignent dans le même pivot que la mesure ; ils ne sont pas redemandés dans la phase. En l’absence de données, le critère reste non évalué. Une référence nulle ou manquante ne produit aucun pourcentage ni validation. La symétrie d’extension utilise les deux mesures ; toute exception relève d’un override clinique documenté.

Les mesures opéré/controlatéral de force et d’impulsion sont lues dans le même enregistrement. La flexion peut réutiliser la référence controlatérale déjà enregistrée. Les champs restent corrigeables via le pivot source. Les données d’une autre latéralité ne sont pas utilisées pour valider les critères du côté opéré. Les critères sont recalculés à l’affichage depuis les pivots et, pour les marqueurs partagés tels que la réaction à 24 h, les séances ; ils ne stockent pas une deuxième copie des mesures. Les boutons **Données sources** ouvrent les enregistrements d’origine.

**Passer à la phase suivante** nécessite une confirmation. Si les critères ne sont pas tous acquis ou qu’une phase est sautée, un motif clinique est demandé. Le clinicien peut également ajuster la phase manuellement ou déclarer un critère validé, non validé, non évalué ou non applicable avec un motif. Les changements sont audités dans `phaseHistory`, avec l’état et les sources des critères au moment du passage. Une dégradation ou une source supprimée est signalée après progression, sans retour automatique à une phase antérieure. Le délai depuis l’opération n’est qu’un contexte.

Les phases et le greffon filtrent les recommandations et leur ordre, jamais les lettres A/B/C/D. Les qualités secondaires sont repliées ; les tests/champs hors phase restent accessibles par **+ Autre mesure / champ**. Les mesures déjà enregistrées et les ajouts manuels restent accessibles lorsque la phase change. L’endurance ne contient que HRET et Single-Leg Bridge ; le Y-Balance est le test sensorimoteur structuré ; les éléments neurocognitifs sont des tags sans score. Les métriques SSC ont une seule décision globale. Les bilans isocinétiques sont secondaires et ne remplacent pas la force en Newton dans les critères.

Le N/kg utilise la masse corporelle saisie dans le pivot (reprise pour les saisies suivantes). Les hop tests appartiennent à Fonction / exposition et ne déclenchent aucune décision clinique automatique. Pour le 6 m Timed Hop, le LSI de performance est controlatéral / opéré × 100 (temps plus faible favorable) ; les distances et forces utilisent opéré / controlatéral × 100. L’ACL-RSI conserve score, date et évolution sans seuil d’autorisation universel.

Le moteur de phase est déclaré par configuration (`template.phases[].criteria`, callbacks d’évaluation, recommandations, champs par phase, priorités, résultats et contexte). Il ne teste pas l’identifiant LCA pour son fonctionnement. Les champs `caseData`, `phase`, `phaseHistory`, `criterionOverrides` et les marqueurs `session.clinicalValues` sont facultatifs pour les anciens templates. La migration v3→v4 change seulement la version de l’enveloppe et conserve les anciens cas à l’identique ; la sauvegarde brute locale précède cette migration, comme pour v1/v2. Aucun cas, pivot ou mesure CHEVILLE/GENOU n’est créé ou réinterprété par cet ajout.

`tests/lca.cjs` couvre le parcours chirurgical et les quatre phases, les critères calculés sans double saisie, les confirmations, les exceptions documentées, la force normalisée, le CMJ, les pogos, les expositions, l’ACL-RSI, les hop tests, le bilan externe, les séances, l’édition et la suppression de pivots, les dégradations, la persistance et l’export/restauration. Il vérifie aussi que deux cas CHEVILLE/GENOU préexistants restent identiques.

## Refonte de l’interface clinique

Navigation latérale de 80 px dès 1000 px ; navigation basse et onglets sur tablette portrait et mobile. Les patients disposent de filtres Tous / Actifs / Archivés, d’initiales et des templates associés. Les séances sont présentées en timeline avec indicateurs et décision, et les actions secondaires conservent une cible tactile de 44 px. Les qualités et pivots utilisent une navigation par qualité à gauche sur grand écran. Le bandeau LCA sépare les critères des freins sans changer leur calcul.

Les grilles passent en une colonne sous 700 px. Les conteneurs et formulaires utilisent `min-width: 0`, des largeurs maximales et le retour des textes longs à la ligne ; les modales sont limitées à 760 px et à la hauteur disponible. La navigation basse reste fixe et le contenu conserve une marge finale pour rester accessible au défilement.

`node tests/ui.cjs` vérifie les trois templates, les quatre onglets et les modales séance/pivot/cas à 1440, 1180, 820 et 390 px, avec noms et commentaires longs. Les captures sont enregistrées dans `/tmp/cockpit-ui-review` ou `UI_SCREENSHOT_DIR`. Les six suites de régression clinique restent inchangées. `node tests/mockup.cjs` contrôle les filtres de templates, le panneau de qualité sélectionné, les accès aux mesures existantes et nouvelles, et la conservation des données à la fermeture des formulaires.

La maquette fournie a été intégrée lors de la seconde passe : navigation marine avec icônes SVG, lignes patients avec templates et progression LCA réelle, timeline reliée, cartes cliniques avec lettre distincte et panneau Mesure → décision → qualité. Les couleurs A/B/C/D restent celles du cahier des charges clinique initial. Les âges et sports ne sont pas inventés : seules les données existantes sont affichées.

Limite existante : le dépôt ne contient pas `sw.js`, bien que son enregistrement soit déjà prévu dans l’application : cette refonte conserve ce comportement existant et ne certifie pas le mode hors ligne sur un iPad réel.

## Suivi des séances : check-in → travail → fin de séance → décision

Le formulaire de séance comporte, dans cet ordre :

- **Check-in** : évolution (Mieux / Stable / Moins bien), réaction à 24 h (Bonne / Acceptable / Mauvaise), observance (Fait / Partiel / Non fait) et commentaire facultatif. Les boutons sont à sélection unique et peuvent être désélectionnés.
- **Travail / exposition du jour** : texte simple.
- **Fin de séance** : exactement trois KPI, Douleur max et RPE sur 10, puis objectif atteint (Oui / Partiellement / Non). Les valeurs nulles restent vides ; une valeur numérique zéro est conservée.
- **Décision / prochaine étape** : texte libre mis en évidence.

Tous ces champs sont facultatifs. Le design général et les autres vues restent inchangés. Les marqueurs postopératoires LCA restent accessibles dans le check-in, sous une section repliée ; le nouveau champ réaction à 24 h ne remplace pas les marqueurs sources des critères de phase.

La compatibilité utilise une projection de lecture, sans migration de base. L’exposition historique préremplit le travail du jour ; une ancienne douleur n’alimente Douleur max que si elle est numérique et comprise entre 0 et 10. Les tendances qualitatives ne produisent aucun score ni évolution inventés. Une observance historique unique et équivalente peut préremplir le check-in (`Complète`, `Partielle`, `Non faite`) ; les valeurs ambiguës restent non renseignées. Le nouveau champ `adherenceCheckin` évite de remplacer l’ancien tableau `adherence`. Les champs historiques `pain`, `symptoms`, `exposure`, `tolerance`, `adherence` et les extensions inconnues sont conservés et les informations historiques restent consultables dans la timeline et le formulaire. Une correction de séance conserve identifiant, numéro et date ; les marqueurs postopératoires inchangés ne sont pas réécrits.

`node tests/sessions.cjs` vérifie la création complète et partielle, les sélections exclusives, les bornes et valeurs zéro, les trois KPI, la modification/suppression et leur annulation, la lecture des séances anciennes, la conservation des champs et autres cas, le rechargement et les quatre largeurs 1440/1180/820/390 px. Les captures sont disponibles dans `/tmp/cockpit-session-review` ou `UI_SCREENSHOT_DIR`. Les tests smoke et longitudinal ont été adaptés aux nouveaux contrôles de séance ; les assertions de régression des autres parcours sont conservées.
