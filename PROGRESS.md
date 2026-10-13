# PROGRESS — ExziFit

Journal de bord. Lire [CLAUDE.md](CLAUDE.md) d'abord.
Mis à jour à chaque fin d'étape et avant tout `/clear`.

## Statut : style « Fiche de perso » publié en 0.1.8, à essayer à la salle (2026-10-13)

Les trois chantiers ExziHub (sous-titres *Rick and Morty*, module tâches, profil Malt) sont en
sommeil depuis le 2026-10-13 — état dans `ExziHub/docs/pi/REPRISE.md`, « Chantiers en sommeil ».

Modèle de données : [docs/modele-donnees.md](docs/modele-donnees.md), validé sur papier par
[src/donnees/programmes/bloc-force.json](src/donnees/programmes/bloc-force.json).

**Squelette, partie 1 (2026-10-13)** — voir le [README](README.md) :
- Tauri 2.11 + React 18/TS/Vite 5, versions npm et crates figées à la même mineure.
- Stockage Rust (`fichiers.rs`) : écriture atomique, chemins validés, sauvegarde quotidienne
  au lancement (30 jours + 1re de chaque mois). Couche JSON avec contrôle de `format`.
- 4 thèmes en variables CSS (Nuit par défaut), choix enregistré dans `reglages.json`.
- Minuteur repris du prototype, permissions d'alarme exacte dans le manifeste.
- Écrans : Séance (vide) et Réglages (thème, test de vibration, chemin des données).
- Le prototype `C:\Users\tomro\exzifit-proto` n'a plus d'utilité, supprimable.

**Mise à jour en ligne (2026-10-13)** — voir le README, « Mise à jour en ligne » :
- Dossier Nextcloud `ExziFit` partagé par lien public (lien dans `src-tauri/maj.json`) :
  `ExziFit.apk` + `version.json`. `npm run publier` compile, signe et dépose.
- Clé release propre à ExziFit : `C:\Users\tomro\.android\exzifit-release.jks`.
- 0.1.0 publiée (5,9 Mo) ; lien vérifié depuis le PC (version.json lu, empreinte de l'APK identique).
- Vérifié sur le S23 par Tom : installation, thème persistant, vibration écran verrouillé,
  le bandeau Installer reste à voir : 0.1.1 (envoi des sauvegardes) est la première mise à jour publiée.

**Envoi des sauvegardes (2026-10-13)** — voir le README, « Sauvegarde sur Nextcloud » :
- `envoi.rs` + `paquet_a_envoyer` dans `fichiers.rs` : un JSON par jour où les données ont changé,
  PUT WebDAV public sur un partage en dépôt de fichiers. Tests Rust et build verts.
- Partage `ExziFit-backups` créé par Tom en « can edit » (dépôt seul introuvable dans l'UI ;
  modification de `oc_share` id 20 → permissions 4 refusée à Claude par l'outil). PUT testé au
  curl (201 puis 204 en écrasement) ; lecture et suppression anonymes possibles aussi : risque
  noté dans le README, à corriger si le lien de mise à jour sort du cercle de Tom.

**Correctif dossier de données (2026-10-13, 0.1.2)** — l'envoi échouait sur le S23 (« stream did
not contain valid UTF-8 ») : sur Android `app_data_dir()` contient le cache de la WebView, copié
dans la sauvegarde. Données déplacées dans `donnees/` (migration au lancement, ancien
`sauvegardes/` supprimé), envoi `-dev` pour les builds de debug. Vérifié sur le PC avec
`npm run tauri dev` : sauvegarde du jour = `reglages.json` seul, `exzifit-2026-10-13-dev.json`
reçu dans `ExziFit-backups`. **Tester désormais avec `npm run tauri dev` avant de publier.**
Vérifié ensuite : `exzifit-2026-10-13.json` envoyé par le S23 (réglages seuls, thème braise).

**Saisie d'une série (2026-10-13, 0.1.3)** — voir le README, « Organisation » :
- Séance libre, sans programme : choix de l'exercice (25 exos de base dans `exercices.ts`,
  ceux du Bloc Force), charge et reps préremplies, Valider, RIR en un tap, repos de 120 s fixe,
  séries du jour et 3 dernières séances de l'exo affichées, Terminer en deux taps.
- `en-cours.json` réécrit à chaque série (reprise après kill), séance ajoutée au journal du mois
  en fin de séance (le modèle disait « à chaque série » : corrigé dans le doc). `prevu` = valeur
  préremplie.
- Vérifié : tests Vitest (préremplissage, historique, arrondi), parcours complet piloté dans Edge
  headless à 390 px (saisie, RIR, rechargement = reprise, fin, préremplissage la fois suivante).
  Pas testé dans `tauri dev` ni sur le S23 : vibration du repos et annulation en fin de séance
  (Android seulement) à confirmer à la salle.

**Programme du jour (2026-10-13, 0.1.4)** — retour de Tom sur la 0.1.3 : « inutilisable, je
dois chercher quels exos je fais, l'ergonomie est horrible ». Voir le README, « Organisation » :
- Le Bloc Force est branché (JSON déplacé de `docs/reference/` vers `src/donnees/programmes/`) :
  accueil = jour et semaine proposés, aperçu des exos (séries × reps, charge, repos), 1RM du bloc
  et poids de corps saisis une fois (`blocs.json`, `poids.json`), calibration par la 1re série.
- Saisie : commandes en bas d'écran, RIR à la place de Valider, repos du programme, « Suivant »
  en un tap, supersets alternés, Remplacer, échauffement et disques par côté. Barre de nav
  masquée pendant la séance.
- Vérifié : 23 tests Vitest (prescriptions, double progression, RPE, rotation et J6, semaine,
  échauffement, disques) ; `npm run build` ; parcours piloté dans Edge headless à 390 px (J1
  complet avec 1RM saisi, J5 avec calibration, superset, remplacement, rechargement = reprise,
  fin de séance → J6 proposé). Un bug de reprise trouvé et corrigé ainsi. Pas testé sur le S23.
- Pas fait (volontairement, hors minimum salle) : avertissements « 48 h hack squat / soulevé »,
  semaine de test S4, résumé de fin de séance, RPG.

**Séries de retour (2026-10-13, 0.1.5)** — retour de Tom : « 4 séries ok, la 5e à 3 reps au
lieu de 5, je deload un peu et j'en fais 3 ou 4 en plus pour le volume ».
- Séries prévues faites et la dernière sous la cible de reps → « Série en plus » préremplie à
  −10 % (total corps + lest sur un lesté), reps de la cible. Une série de retour ratée allège
  encore de 10 %. Les séries en plus restent `travail` (volume réel), `prevu` = charge de retour.
- Vérifié : 25 tests Vitest (dont `retour`), `npm run build`, publié. Pas piloté dans le
  navigateur ni testé sur le S23.


**Recalage par le RIR, montée guidée (2026-10-13, 0.1.6)** — retour de Tom : « je ne peux
toujours pas downgear ; sans 1RM il faut un calibrage automatique ; 140 × 5 fini à 2 RIR → me
proposer un peu plus haut ».
- `recalage` (programme.ts) : au principal (`pct1rm`, RIR visé 1) et au RPE (RIR visé 10 − RPE),
  la série suivante = charge qui donne les reps visées au RIR visé, d'après la dernière série et
  son RIR (Epley). 2 RIR → on monte, 0 RIR / série ratée → on baisse. Remplace le −10 % pour ces
  exos ; les accessoires gardent le −10 % après une dernière série ratée.
- Reps corrigeables sur l'écran du RIR (Valider par réflexe après une série ratée).
- Montée guidée sans 1RM ni historique : barre, puis +20 % (≥ 8 pas) tant que le RIR est 4+,
  paliers notés `echauffement`, repos 90 s ; la première série à ≤ 3 RIR compte et relance le
  repos complet. Plus d'écriture dans `blocs.json` à la calibration.
- `rmEffectif` : % calculés sur max(1RM du bloc, estimé de la dernière séance du bloc) ; sans
  1RM du bloc, estimé de la dernière fois (placeholder « ≈ » dans le formulaire 1RM).
- Vérifié : 31 tests Vitest, `npm run build`, parcours piloté dans Edge headless à 390 px
  (montée 20 → 40 → 60, 60 × 5 R2 → 62,5, série ratée 3 reps corrigée → 57,5, rechargement =
  reprise). Pas testé sur le S23.
- Limites : la montée part de la barre (≈ 7 paliers pour 145 au bench) ; pendant le RIR d'un
  palier, l'en-tête affiche brièvement « Série 2/5 ».

**Règles du bloc, semaine de test, fin de bloc, résumé (2026-10-13, 0.1.7)** — étape 2 du plan,
sans retour de salle entre-temps. Voir le README, « Organisation », et le modèle (`test`, fin de bloc) :
- `avertissements` : règle `ecart` touchée → ligne rouge sur l'accueil (« Hack squat il y a 20 h :
  48 h conseillées avant Soulevé de terre. »), compté depuis la fin de la séance. Rien n'est bloqué.
- Semaine de test (S4) : après les séries prévues du principal, « Test de 1RM / 3RM · tentative n »,
  ouverture à 95 % du max estimé, chaque tentative recale la suivante à 0 RIR ; fini à 0 RIR ou
  sous les reps ; une fois par exo et par bloc ; « Passer le test ». Séries marquées `test: true`.
- Fin de bloc : dernière semaine bouclée → carte « Bloc terminé » avec les 1RM proposés (test,
  sinon 1RM effectif, au demi-kilo), bouton « Nouveau bloc · J1 » qui clôt l'ancien (`fin`) et
  ouvre le nouveau en S1. Avant, le bloc restait en S4 indéfiniment.
- Résumé après Terminer : durée, séries, tonnage (corps compté sur les lestés, distances
  exclues), records de 1RM estimé (pas de record la première fois). Évolution des stats : quand
  le personnage existera.
- 1RM estimé : un single à 0 RIR vaut sa charge (Epley le gonflait de 3 %) ; partout
  (`rmEffectif`, records, test). Une tentative à 0 RIR prime sur l'estimé des tentatives à 1 RIR.
- Vérifié : 38 tests Vitest (dont règles, test, fin de bloc, bilan), `npm run build`, parcours
  piloté dans Edge headless à 390 px (avertissement J4, S4 J1 : 3 × 120 puis 152,5 R1 → 157,5 R0,
  rechargement = reprise, résumé ; bloc fini → nouveau bloc à 155 au bench, S1 à 125). Publié en
  0.1.7 (version.json 0.1.7 dans le dossier Nextcloud local). Pas testé sur le S23.
- Limites : la semaine de test n'a pas de séance « décharge seule » distincte (le schéma S4 est
  la décharge) ; l'arrondi au demi-kilo du 1RM suivant est arbitraire ; un 1RM du bloc saisi à la
  main dans l'ancien bloc n'est pas proposé au suivant s'il dépasse le test (le test fait foi).

**Style « Fiche de perso » (2026-10-13, 0.1.8)** — piste B des maquettes, choisie par Tom :
- Polices Silkscreen (titres, libellés, minuteur, RIR) et Chakra Petch (texte, chiffres) embarquées
  dans `src/polices/` (6 woff2 latins, ~55 Ko, OFL) : rien n'est chargé depuis Internet.
- `styles.css` réécrit sans toucher aux classes ni aux écrans : angles carrés, bordures 3 px, bouton
  principal en relief (`--accent-ombre`, s'enfonce au toucher), RIR choisi en accent plein.
- Braise passe en thème par défaut, aux couleurs exactes de la maquette ; `--accent-ombre` et `--ok`
  ajoutés aux 4 thèmes. Corrigé au passage : mots coupés au milieu (`.petit`), rangées −/+ décalées.
- Vérifié : `npm run build`, 38 tests Vitest, captures Edge headless 390 px (accueil, saisie, RIR +
  minuteur, liste du jour). Publié en 0.1.8. Pas vu sur le S23.
- Pas encore fait : le personnage (attend les formules de stats), les pastilles de séries et les
  disques dessinés de la maquette sur l'écran de saisie.

## Prochaine étape

1. **Essai à la salle par Tom** (0.1.7) : saisir les 1RM et le poids de corps à l'accueil
   (« 1RM du bloc »), choisir la bonne semaine / le bon jour si le bloc est déjà commencé ;
   juger la saisie d'une main, la vibration en fin de repos, la reprise si l'app est tuée, le
   recalage par le RIR. Noter précisément ce qui gêne encore.
2. Puis le personnage (stats calculées) : écrire d'abord le document des formules (modèle de
   données, « Stats du personnage »), puis le résumé de fin de séance affichera leur évolution.
3. **Suite du design B** (le style de base est en 0.1.8) : retours de Tom sur le style, puis le
   personnage dessiné depuis les paliers de stats.
   Maquettes : https://claude.ai/artifact/WaGhMQfmgDLjNcm6bqfryC (rangées B et « B · Le personnage
   change avec les stats » ; les seuils de paliers y sont fictifs).

## Décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-10-08 | Le jeu est une lecture des données, jamais une monnaie | ce qui donne de l'XP devient ce qu'on s'entraîne à faire |
| 2026-10-08 | Pas de comptes ni de social en v1 | triple l'ouvrage et arrive quand la motivation retombe |
| 2026-10-08 | Local d'abord, export dès le premier jour | l'historique d'entraînement est irremplaçable |
| 2026-10-13 | Séances modèles + objectif preset, charges calculées et ajustables en 1 clic | Tom veut choisir son type de séance sans calculer lui-même |
| 2026-10-13 | RIR saisi à chaque série (1 tap) | c'est la donnée qui corrige la charge suivante |
| 2026-10-13 | Couleurs via variables de thème uniquement | Tom change souvent de couleurs |
| 2026-10-13 | Pas d'import d'historique | notes hétérogènes, départ propre |
| 2026-10-13 | Nom : ExziFit | choix de Tom |
| 2026-10-13 | − / + n'ajuste que la série en cours, historique des séances précédentes affiché | éviter la double correction avec le RIR, garder le repère visuel |
| 2026-10-13 | Superset = mode de séance comme force/hypertro/endurance | choix de Tom |
| 2026-10-13 | Avatar pixel art, résumé de fin de séance, thème sombre par défaut | choix de Tom |
| 2026-10-13 | Thèmes prêts (pas d'éditeur), règle 60/30/10 | Tom change souvent de couleurs, sans vouloir tout régler |
| 2026-10-13 | Dossier renommé `Muscu` → `ExziFit` | nom choisi |
| 2026-10-13 | Programme de référence : `docs/reference/bloc-force-octobre.html` | cas réel que le modèle de données doit couvrir |
| 2026-10-13 | 1RM figé au début du bloc, e1RM continu seulement affiché | les charges ne bougent pas en plein bloc |
| 2026-10-13 | Double progression sur les accessoires | règle simple, pilotée par le RIR |
| 2026-10-13 | Règles du bloc = avertissements, J6 sauté auto | prévenir sans bloquer |
| 2026-10-13 | Modèle générique (rotation + semaines optionnelles), pas taillé pour le Bloc Force | ce bloc était un essai, les suivants auront d'autres formes |
| 2026-10-13 | Stack Tauri 2, mises à jour par le cloud comme ExziHub, sous réserve d'un prototype | dev dans le navigateur, pas de câble, circuit de mise à jour déjà écrit |
| 2026-10-13 | Prototype validé sur le S23 : minuteur verrouillé (alarme exacte) + fichier JSON | Tauri confirmé, React Native écarté |
| 2026-10-13 | Données : on stocke les faits, on calcule le reste (rotation, 1RM estimé, stats) | une seule source de vérité ; une stat ne peut pas être créditée |
| 2026-10-13 | Journal en un fichier JSON par mois | le passé n'est jamais réécrit, une corruption ne touche qu'un mois |
| 2026-10-13 | `pct` à deux valeurs = fourchette, l'app propose le bas | réponse de Tom pour « 88–90 % » |
| 2026-10-13 | Sauvegarde auto sur Nextcloud quand le réseau est là, jamais bloquante | une sauvegarde sur le seul téléphone ne survit pas à sa perte |
| 2026-10-13 | Sauvegardes locales : 30 derniers jours + 1re copie de chaque mois | borne la place sans perdre de point de reprise ancien |
| 2026-10-13 | Crates Tauri figées en `~` (mineure), `Cargo.lock` repris du prototype | `"2.11"` laissait Cargo prendre 2.12 (refusé par la CLI) ; un `cargo update` tire des `tauri-runtime` récents qui ne compilent plus avec tauri 2.11 |
| 2026-10-13 | Mise à jour par dossier Nextcloud à lien public, un seul APK au nom stable + `version.json` | Tom seul utilisateur : pas de variantes ni de dossier `Application/` comme ExziHub |
| 2026-10-13 | Clé de signature release à part (pas celle d'ExziHub) | une clé perdue ou fuitée ne touche qu'une app |
| 2026-10-13 | Publier directement après chaque changement vérifié | demande de Tom : installer une fois, ensuite tout passe par l'app |
| 2026-10-13 | Sauvegarde Nextcloud = copie datée (un JSON par jour modifié), pas un miroir | une corruption locale ne peut pas écraser une bonne copie distante |
| 2026-10-13 | Dossier à part, pas d'élagage distant | le lien est dans l'APK public ; ordre de grandeur : quelques dizaines de Mo par an |
| 2026-10-13 | Données dans `donnees/` sous `app_data_dir()` | sur Android la racine contient le cache WebView ; même disposition sur PC et téléphone |
| 2026-10-13 | Tests sur PC par `npm run tauri dev`, envoi en `-dev` | Tom ne veut pas réinstaller sur le téléphone pour tester |
| 2026-10-13 | Séance libre d'abord (sans programme), préremplissage = série précédente du jour, sinon 1re série de la dernière fois | saisie utilisable tout de suite ; la dernière série d'une séance est souvent dégradée |
| 2026-10-13 | Journal écrit en fin de séance, `en-cours.json` à chaque série | une seule copie de chaque série ; la reprise après kill passe par `en-cours.json` |
| 2026-10-13 | Partage des sauvegardes en « can edit » | choix de Tom (dépôt seul introuvable dans l'UI) ; à repasser en dépôt seul si le lien de mise à jour devient vraiment public |
| 2026-10-13 | Programme du jour avant tout le reste (RPG après) | retour de Tom : l'app doit dire quoi faire, comme la page du Bloc Force |
| 2026-10-13 | Bloc Force dans le code (`src/donnees/programmes/`), pas d'éditeur | un seul programme utilisé ; `programmes.json` le jour où Tom en écrit un |
| 2026-10-13 | En programme : charge préremplie = série précédente du jour, sinon prescription ; reps = prescription | garde une correction − / + sur l'exo, sans dériver de la cible de reps |
| 2026-10-13 | Commandes de saisie en bas d'écran, RIR à la place de Valider | pouce d'une main ; les deux gestes restent au même endroit |
| 2026-10-13 | Série ratée en fin de poste → séries en plus à −10 %, comptées en travail | demande de Tom (volume après échec) ; le volume compte pour les stats, la progression n'en dépend pas (1re série / max e1RM) |
| 2026-10-13 | Recalage série par série par le RIR (visé 1 au principal), série ratée → baisse | demande de Tom : 140 × 5 à 2 RIR doit faire monter, baisser sans clic |
| 2026-10-13 | 1RM des % = max(bloc, dernière séance du bloc), jamais baissé ; remplace « figé » | « par séance, mais toujours en optimisant la surcharge progressive » |
| 2026-10-13 | Calibrage = montée guidée (+20 %, paliers 4+ en échauffement) | réponse de Tom ; +40 % testé, trop risqué près du max |
| 2026-10-13 | Test de fin de bloc : ouverture 95 %, recalage à 0 RIR, une fois par exo et par bloc | reprend la page du Bloc Force (bench testé au J1, pas au J5) |
| 2026-10-13 | 1RM du bloc suivant = résultat du test, sinon 1RM effectif | le test est une mesure ; « jamais baissé » vaut dans un bloc, pas d'un bloc à l'autre |
| 2026-10-13 | Single à 0 RIR = sa charge dans tous les 1RM estimés | Epley donnait 162,75 pour 157,5 × 1 au max, record fictif |
| 2026-10-13 | Design : piste B « Fiche de perso » (police pixel, angles carrés, barres en cases, accent du thème) | choix de Tom parmi 3 pistes (A gros chiffres, B RPG, C instrument) |
| 2026-10-13 | Personnage qui change visuellement : Force → carrure, Endurance → taille/abdos, Constance → posture/teint/halo ; redescend avec la stat | demande de Tom ; un trait visible = une stat calculée, jamais un cosmétique gagné |
| 2026-10-13 | Police pixel (Silkscreen) retirée, Chakra Petch partout, libellés en capitales espacées (0.1.9) | retour de Tom : pixel art oui, police pixel trop fatigante à lire ; Chakra Petch déjà embarquée, angles coupés cohérents avec le pixel art |
| 2026-10-13 | Vérification de mise à jour aussi au retour au premier plan (0.1.10) | Tom ne voyait pas la 0.1.9 : Android reprend l'app en mémoire, la vérification ne tournait qu'au démarrage à froid |
