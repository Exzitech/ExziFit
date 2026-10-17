# CLAUDE.md — ExziFit

App de musculation avec une couche RPG. **Pour Tom d'abord**, des amis ensuite,
peut-être des clients un jour — dans cet ordre. La v1 sert Tom, et quelques potes depuis le
2026-10-15 (même APK, écran de bienvenue, données locales, export manuel ; pas d'envoi Nextcloud
pour eux : le dossier de dépôt est celui de Tom).
Journal du chantier : [PROGRESS.md](PROGRESS.md).

## Pourquoi cette app existe

> **À remplir par Tom, et c'est la section la plus importante du fichier.**
> La phrase précise : quel geste, dans quelle app du marché, l'a assez énervé pour
> qu'il en écrive une. Pas « l'UI est lourde » — un moment concret.
> Tant que cette ligne est vide, toute décision de périmètre est une préférence
> déguisée en besoin, et l'app finira en clone de Hevy avec des badges.

## Le principe qui ne se négocie pas

**Le jeu est une lecture des données d'entraînement, jamais une monnaie parallèle.**

Ce qui donne de l'XP devient ce qu'on s'entraîne à faire. XP au volume → volume
poubelle. XP aux PR → articulations grillées. XP à la régularité → on va à la salle
pour la série de jours, pas pour progresser. Donc :

- Les stats du personnage sont **calculées** depuis l'historique réel, jamais créditées.
  La Force est une fonction des charges estimées sur les gros mouvements, pas un compteur.
- Elles **baissent** quand l'entraînement s'arrête, parce que c'est vrai.
- Pas de récompense achetable avec de l'XP, pas de coffre, pas de série de jours qui punit.
  Ces mécaniques retiennent des gens qui n'ont pas envie de s'entraîner ; ce n'est pas la cible.

Toute proposition qui transforme une stat en monnaie se refuse en citant cette section.

## Les trois choses de la v1, et rien d'autre

1. **Logger une séance plus vite que n'importe quelle app existante.**
2. **Un personnage dont les stats viennent de l'historique**, qui monte et qui descend.
3. **Une réponse à « quelle charge aujourd'hui »** assez bonne pour être suivie sans discuter.

Le reste est du contenu, pas du produit. Le point 3 est le vrai trou du marché : les apps
savent noter ce qui a été fait, aucune ne dit correctement quoi mettre sur la barre ensuite.

## Contraintes de forme, à tenir comme des tests

La saisie entre deux séries se fait **debout, mains moites, 90 s de repos, attention nulle**.

- **Deux gestes maximum** pour enregistrer une série : charge et reps préremplies depuis la
  dernière fois, un tap pour valider, une correction quand ça change.
- Utilisable **d'une seule main**, cibles tactiles larges.
- **Fonctionne en mode avion**, toujours : pas de réseau dans une salle en sous-sol.
- Mesuré **à la salle**, pas au bureau. Une saisie jugée rapide sur un écran de PC ne compte pas.

Si ce chemin est lent, l'app meurt en six semaines quelle que soit la qualité du RPG.

## Les données

Des années d'historique d'entraînement sont **irremplaçables** : on ne refait pas ses séances
de 2027. Donc, dès le premier jour et avant toute fonctionnalité :

- Stockage **local**, dans un format relisible à la main.
- **Export** disponible, et une sauvegarde automatique.
- Jamais de test sur le fichier vivant ; copie d'abord, toujours.
- Toute migration de modèle de données écrit une sauvegarde horodatée avant de toucher à quoi
  que ce soit, et sait revenir en arrière.

## Hors périmètre v1 (décidé)

- **Pas de comptes, pas de serveur, pas d'amis, pas de classement.** Comparer avec un pote =
  un fichier qu'on s'envoie. Le social multiplie l'ouvrage par trois et arrive pile quand la
  motivation retombe. Le socle existe déjà (VM + Nextcloud) le jour où quatre personnes le réclament.
- **Pas de clients, pas de monétisation en v1.** Le freemium viendra (voir ci-dessous), mais pas
  avant que l'app serve : une app de santé vendue, c'est des obligations légales (RGPD, données de
  santé), du support, des remboursements, le Play Store et sa facturation, et un vrai serveur pour
  la synchro (pas le Nextcloud de Tom).
- Rien qui ne serve pas directement les trois points de la v1.

## Freemium (décidé le 2026-10-17, après la v1)

**Une app de qualité en gratuit, des conforts de vie en payant, sans abus.**

- **Gratuit** : toute la saisie, la charge du jour, le personnage et toutes ses stats, le journal,
  le résumé et les records, l'export, la sauvegarde locale et la restauration.
- **Payant** (proposé, à affiner) : partage avec les potes, thèmes au-delà du thème par défaut,
  synchro entre appareils et sauvegarde dans le cloud, analyses longues (fiche exo avec courbes,
  courbe des stats, bilans de bloc), programmes fournis en plus et programmes perso illimités,
  plusieurs salles.
- **Jamais payant** : les données (historique, export, restauration : les retenir serait une prise
  d'otage) et le personnage (pas de stat, de trait ou de boost achetable : voir le principe plus haut).
- Pas de pub, pas de limite sur le nombre de séances ni sur la durée d'historique.
- **Modèle** : « Pro » en **achat unique** au lancement (Google Play d'abord, iOS si ça marche).
  Abonnement seulement pour les fonctions qui coûtent un serveur chaque mois (partage, le jour où il
  en demande un). Une fonction achetée n'est jamais retirée ni remise dans un abonnement ; jamais
  d'essai qui bascule en abonnement ni de relance d'achat pendant une séance.
- **Synchro payante** : Drive de l'utilisateur (Android) / iCloud (iOS) envisagés avant tout serveur
  à nous : pas de compte ni de données de santé chez nous. Comptes Google + Apple (l'App Store
  impose Apple si Google est proposé) seulement quand le partage l'exige.
- D'ici là : pas de paywall dans le code. Une fonction prévue payante reste isolée derrière une
  condition simple, sans mêler sa logique à la saisie.

## Stack — Tauri 2 + React/TypeScript/Vite (décidé le 2026-10-13, prototype validé)

**Raisons** :
- Développement de l'interface dans le navigateur du PC, sans téléphone branché.
- **Mise à jour en ligne obligatoire** (exigence de Tom : jamais besoin du câble). Le circuit
  d'ExziHub sert de point de départ, pas de modèle à copier à l'identique : APK publié
  sur le partage Nextcloud avec une entrée dans `index.json`, l'app compare sa version au
  lancement, télécharge, vérifie le SHA-256 et ouvre l'installeur Android. Voir dans ExziHub :
  `hub/src-tauri/src/maj_apk.rs`, `gen/android/.../InstallateurPlugin.kt`, `npm run publier-apk`
  et le README, section « Mise à jour depuis l'app ». Le câble ne sert plus qu'au débogage.
  **Depuis le 2026-10-17, ce circuit sert l'app dev** (« ExziFit Dev », données à part) **et l'app
  des potes** (identifiant prod, tant qu'il n'y a pas de compte Play Console) ; la version Google
  Play n'en aura pas, Play interdit toute autre mise à jour. Voir le README, « Dev et prod ».
- Chaîne de build Android, signature et Nextcloud déjà en place et connus de Tom.

**Alternatives écartées** :
- PWA : pas de notification programmée, donc minuteur muet écran éteint ; données dans le
  navigateur, effaçables avec le cache.
- React Native (Expo) : le plus « natif » en main, mais une chaîne entièrement nouvelle, et la
  mise à jour par le cloud serait à refaire (ou à confier à EAS, le service d'Expo).
- Plugin d'ExziHub : zéro infrastructure, mais un lancement plus long (le hub, puis le plugin)
  et un rythme de publication lié au hub. ExziFit reste une app à part, qui réutilise le code.

**Prototype validé le 2026-10-13 sur le S23** (Android 16) : le minuteur vibre téléphone
verrouillé (15 s et 90 s), et une série écrite dans un fichier JSON survit à la fermeture de
l'app. Ce qu'il en reste à reprendre :
- Minuteur = **notification programmée** (`tauri-plugin-notification`, `Schedule.at(fin, false,
  true)`, canal à importance haute avec vibration), jamais un compteur JS.
- **`USE_EXACT_ALARM`** dans le manifeste Android (et `SCHEDULE_EXACT_ALARM` avec
  `maxSdkVersion="32"`) : sans elle, le plugin retombe sur une alarme approximative qu'Android
  peut retarder de plusieurs minutes.
- Fichier : `app_data_dir()`, écriture atomique (fichier `.tmp` puis renommage).
- Versions npm `@tauri-apps/*` alignées sur les crates Rust (même mineure), sinon la CLI refuse
  de compiler.

## Règles de travail

Priorités : performance, maintenabilité, simplicité, peu de contexte/tokens, pas de dépendance
ni d'abstraction sans justification concrète.

- **Comprendre avant de modifier** : chercher les appelants et les invariants ; ne pas réécrire
  du code qui marche par goût de style.
- **Petits changements cohérents** ; refactorings non liés séparés.
- **Erreurs explicites** : pas d'exception avalée, pas de repli large sans justification.
- **Optimiser sur mesure** : baseline, métrique, un seul changement, re-mesure. Jamais à l'intuition.
- **Tests à la bonne échelle** : unitaire pour le calcul des stats et la progression (c'est de la
  logique pure, elle doit être couverte), régression pour un bug corrigé. Pas de test qui recopie
  l'implémentation.
- **Ne pas committer ni pousser sans demande.**
- **Ne jamais annoncer une vérification non exécutée** ; rapporter commandes, résultats et échecs.
- Actions destructrices ou difficiles à annuler : expliquer, lister ce qui est touché, demander
  confirmation.

## Fonctionnement décidé (2026-10-13)

- **Séances modèles** (ex. « Push A ») créées une fois ; l'app propose la suivante dans la rotation.
- **Objectif par séance** : force / hypertrophie / endurance, en presets (plages de reps, repos, RIR cible).
- **Charges calculées** par l'app, ajustables **d'un clic** (− / +) quand c'est trop dur ou trop facile.
- **RIR à chaque série** : un tap après validation (gros boutons), il corrige la suggestion suivante.
- **Calibrage** d'un exercice sans historique : montée guidée en séance (l'app propose chaque palier
  d'après le RIR), jusqu'à une série fiable qui donne le 1RM estimé.
- **Arrondi par exercice** (barre, haltères, machine) + affichage des disques à charger.
- **Repos** : minuteur auto à la validation, vibration à la fin, durée selon l'objectif.
- **Poids de corps** noté (Force relative, exercices au poids du corps).
- **Stats du personnage** : Force, Endurance, par groupe musculaire, Constance (fenêtre glissante).
- **Couleurs changeables facilement** : toutes les couleurs passent par des variables de thème,
  aucune couleur en dur dans les composants. **Thèmes prêts** à choisir dans les réglages (pas
  d'éditeur couleur par couleur), chacun respectant la **règle 60/30/10** : 60 % couleur dominante
  (fond), 30 % secondaire (surfaces, cartes), 10 % accent (action principale, état actif).
  Exception : les couleurs des disques suivent les vrais disques (25 rouge, 20 bleu, 15 jaune…),
  elles ne changent pas avec le thème.
- **Historique visible** pendant la saisie : ce qui a été fait sur cet exercice aux séances précédentes.
  Le clic − / + ne touche que la série en cours ; c'est le RIR qui recale les séances suivantes.
- **Exercices** : liste fournie + exercices perso.
- **Remplacement d'exercice** en cours de séance (machine prise) ; le remplaçant garde sa propre progression.
- **Superset** : un mode de séance, au même titre que force / hypertrophie / endurance.
- **Personnage** : avatar en pixel art **dont le corps lit les stats** : Force → carrure et bras,
  Endurance → taille et abdos, Constance → posture, teint et halo. Il redescend quand la stat baisse ;
  aucun trait ne s'achète ni ne se débloque.
- **Style visuel** : piste B « Fiche de perso » (police Chakra Petch seule, embarquée
  dans l'app, angles carrés, bordures épaisses, barres de stats en cases). Maquettes dans PROGRESS.md.
- **Fin de séance** : résumé (volume, records, évolution des stats).
- **Thème sombre** par défaut.
- Android d'abord ; montre plus tard, pas en v1. Pas d'import d'historique : départ de zéro.

## Programme de référence

[docs/reference/bloc-force-octobre.html](docs/reference/bloc-force-octobre.html) : le programme
réel de Tom (oct. 2026), page HTML autonome. C'est le cas que le modèle de données doit couvrir
sans contorsion :

- **Bloc** de 4 semaines (S1 calibration 80 %, S2 85 %, S3 pic 88–90 %, S4 décharge + test).
- **Rotation de jours** J1–J6, pas un calendrier : on passe au jour suivant quand le précédent
  est fait. J6 optionnel (« points faibles », sauté au-delà de 5 jours lourds d'affilée).
- Chaque jour = **un mouvement principal en % du 1RM** (schéma standard, soulevé ou volume) +
  **accessoires en fourchette de reps** (3 × 8–10), avec repos, RPE cible, note, statut optionnel.
- **Supersets** comme accessoire à deux mouvements.
- **Tractions lestées** : 1RM = corps + lest, lest affiché = % × total − poids de corps.
- **Échauffement calculé** (barre ×10, 40 % ×5, 60 % ×3, 75 % ×2) et **disques par côté**.
- **1RM estimé** par Epley avec la réserve : charge × (1 + (reps + RIR) / 30).
- **Règles** textuelles (48 h entre hack squat et soulevé, 1–2 RIR, 85 % si vidé).

Ce que la page ne fait pas et que l'app doit faire : saisie série par série, historique,
1RM mis à jour automatiquement depuis les séries, minuteur de repos.

Ce bloc était un essai : **les programmes suivants auront d'autres formes**. Le modèle de données
ne doit donc pas être taillé pour lui seul. Un programme = une rotation de séances modèles,
avec en option des semaines qui changent les % (un programme sans périodisation = une seule
semaine répétée).

Décidé le 2026-10-13 sur ce cas :
- **1RM du bloc relevé, jamais baissé** (révisé le 2026-10-13, remplace « figé ») : les % se
  calculent sur max(1RM du bloc, 1RM estimé de la dernière séance du bloc). En séance, chaque série
  recale la suivante sur le RIR (visé 1 au principal : 140 × 5 à 2 RIR → 145) ; une série ratée
  fait baisser les suivantes du jour sans toucher aux prochaines séances.
- **Accessoires en double progression** : toutes les séries en haut de fourchette avec RIR ≥ 2
  → un cran de charge en plus la fois suivante ; sinon même charge, une rep de plus visée.
- **Règles du bloc = avertissements**, jamais de blocage (« hack squat il y a 30 h »). Seul le
  jour optionnel (J6) est sauté automatiquement au-delà de 5 jours lourds d'affilée.

## Encore ouvert

1. La phrase précise du « pourquoi » (section 2 de ce fichier) — Tom n'a pas de réponse pour l'instant.

## Rapport de fin de tâche

Implémenté · fichiers modifiés · validation effectuée · impact perf · doc mise à jour ·
limites connues · prochaine étape (seulement si utile).
