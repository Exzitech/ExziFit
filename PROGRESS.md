# PROGRESS — ExziFit

Journal de bord. Lire [CLAUDE.md](CLAUDE.md) d'abord.
Mis à jour à chaque fin d'étape et avant tout `/clear`.

## Statut : 0.1.22 (synchro PC ↔ téléphone), compte Nextcloud créé, mot de passe à saisir

**Retours de Tom après la séance (2026-10-13)** : traités en 0.1.21 ; « pas synchro avec le PC »
(consulter **et** modifier) traité en 0.1.22, accord de Tom le 2026-10-14. Attend la mise en place
Nextcloud par Tom (README, « Synchro PC ↔ téléphone ») : jamais testée contre le vrai serveur.
Programmes A / C / D ([docs/propositions-programmes.html](docs/propositions-programmes.html)) :
toujours pas choisis. Limite connue : la semaine de décharge ne baisse que le principal.

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
- `envoi.rs` + `paquet_a_envoyer` dans `fichiers.rs` : un JSON par contenu nouveau
  (`exzifit-AAAA-MM-JJ-EMPREINTE.json` depuis 0.1.12), PUT WebDAV public. Tests Rust et build verts.
- Partage `ExziFit-backups` (id 20) passé par Tom en « File request » (dépôt seul) le 2026-10-13.
  Vérifié au curl : PUT 201, même nom renommé « (2) » sans écrasement, GET / PROPFIND / DELETE
  refusés (405). Fichiers de test supprimés sur le serveur.

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

**Stats du personnage, calcul (2026-10-13)** — formules dans [docs/stats.md](docs/stats.md),
validées par Tom (Force relative, Endurance = capacité de travail, Constance au seuil du programme) :
- `src/donnees/stats.ts` : `stats(seances, pesees, seuil, maintenant)` pur ; `e1rmSerie` exporté de
  programme.ts. Rien d'affiché ni de publié : l'app est inchangée pour Tom.
- Vérifié : 50 tests Vitest (12 nouveaux : usure, lesté, filtres, plafond, tranches, seuil),
  `npm run build`.
- Limite : `lirePoidsCorps` ne rend que la dernière pesée ; l'affichage devra lire toutes les pesées.

**Stats affichées (0.1.13)** — onglet « Perso » (`src/ecrans/Personnage.tsx`) : Force, Endurance,
Constance puis les 11 groupes, chacun en barre de 10 cases sous son nom et sa valeur (« pesée
manquante » pour la Force sans pesée). Résumé de fin de séance : carte « Personnage » avec les
stats qui ont bougé d'au moins un point (avant → après, même instant). `lirePoidsCorps` remplacé par
`lirePesees` (toutes les pesées) ; le poids de corps reste la dernière notée.
- Vérifié : `tsc`, 50 tests Vitest, `npm run build`. Publié en 0.1.13 (version.json 0.1.13).
- Vu dans Edge headless à 390 px (2026-10-13), 6 semaines de données de test, 80 kg : onglet Perso
  lisible (Force 87, Endurance 42, Constance 63 = 5 tranches sur 8, valeurs recalculées à la main) ;
  séance libre 3 × 100 × 5 R1 au développé couché → carte « Personnage » Endurance 42 → 43,
  Pectoraux 60 → 68, Épaules et Triceps 60 → 64, Force inchangée (e1RM sous le max existant).
  Pas vu sur le S23.

**Progression (2026-10-13, 0.1.14)** — demande de Tom : une fois la dose des groupes atteinte, plus
rien ne bougeait. Formules dans [docs/stats.md](docs/stats.md), « Progression » :
- `progres()` : par exo, meilleur 1RM estimé des 14 derniers jours contre 28 à 42 jours (séries
  dures ≤ 15 reps, corps compté au poids du corps). Stat Progression = part des exos comparables qui
  montent d'au moins 1 %. Onglet Perso : 4e barre + liste « ▲ +6 % / ▼ −2 % / = / nouveau » ;
  la stat entre aussi dans la carte du résumé.
- Vérifié : 53 tests Vitest (3 nouveaux), `npm run build`, capture Edge headless 390 px (12 exos,
  10 qui montent → 83). Publié en 0.1.14. Pas vu sur le S23.
- Expliqué à Tom : les groupes comptent des séries dures, jamais des kilos (charge lourde = Force).

**Poulie simple / double (2026-10-13, 0.1.15)** — Tom va dans plusieurs salles, poulies simples ou
à moufle (26 kg ici = 52 kg là) ; uni/bilatéral est déjà dans le nom de l'exo :
- `poulie: 2` sur la séance ; `kg` des exos à la poulie = charge effective. Écran : bascule « Poulie
  simple / double » sur la saisie, affichage × 2 (préremplissage, cible, puces, historique, résumé),
  ÷ 2 à la validation. Montage repris de la dernière séance qui a eu un exo à la poulie.
  Les calculs (1RM, double progression, stats, tonnage) n'ont pas changé.
- Vérifié : 55 tests Vitest (2 nouveaux), `npm run build`, parcours Edge headless 390 px (30 en
  simple → 60 en double, journal à 30 + `poulie: 2`, tonnage 360, séance suivante en double).
  Publié en 0.1.15. Pas vu sur le S23.

**Journal : corriger / supprimer une séance (2026-10-13, 0.1.16)** — demande de Tom : sa première
séance contenait des données de test. Onglet « Journal » (4e onglet) :
- Liste des séances terminées → séance ouverte : charge, reps, RIR modifiables par série, ✕ retire
  une série (un exo sans série disparaît), Enregistrer ; « Supprimer la séance » en deux taps.
- `corrigerSeance` (journal.ts) : l'ancienne version est d'abord ajoutée à `corbeille.json`, puis
  le mois est réécrit. Annuler = recopier à la main depuis la corbeille. Une séance supprimée sort
  de la rotation, des 1RM estimés et des stats (tout est recalculé depuis le journal).
- Vérifié : 59 tests Vitest (4 nouveaux, `corrigerListe`), `npm run build`, parcours piloté dans Edge
  headless à 390 px (102,5 × 4 corrigé sur une poulie double, série retirée, séance supprimée,
  journal et corbeille relus). Barre de nav passée en 4 colonnes, libellés en 13 px. Pas vu sur le S23.
- Pas couvert : le 1RM du bloc et le poids de corps se corrigent déjà depuis l'accueil (« 1RM du
  bloc ») ; une séance en cours se termine puis se corrige dans le Journal.

**Pesée visible (2026-10-13, 0.1.17)** — Tom voyait « pesée manquante » sans endroit pour la noter :
champ « Poids de corps » en tête de l'onglet Perso (enregistré à la sortie du champ, ignoré si
identique à la dernière pesée), « pesée manquante » repris dans le titre du panneau 1RM de l'accueil.
- Publiée en 0.1.17 (version.json relu sur le partage : 0.1.17, 6 279 853 octets = APK compilé).
  Revérifié après coup : 59 tests Vitest, `tsc` sans erreur. Pas vu sur le S23.

**Personnage dessiné (2026-10-13, 0.1.18)** — demande de Tom après validation du résumé. Seuils et
dessin dans [docs/stats.md](docs/stats.md), « Personnage » :
- `src/donnees/avatar.ts` : paliers (Force 40/55/70/85, Endurance 25/50/75, Constance 50/75),
  grille 24 × 27 symétrique reprise de la maquette B et retouchée (bras collés à l'épaule, épaules
  arrondies, abdos lisibles), bandes horizontales → un `<rect>` SVG par bande.
- Onglet Perso : personnage du jour (pixel 6 px) à côté de celui d'il y a 8 semaines (même calcul
  à cette date, affiché seulement s'il diffère), puis par stat « palier n/N · à X : effet · sous Y,
  il redescend ». Constance 0 = filtre terne, Constance max = halo à l'accent. Peau et cheveux en
  variables fixes (`--peau`, `--peau-ombre`, `--cheveux`), short à l'accent.
- Vérifié : 67 tests Vitest (8 nouveaux : seuils, Force sans pesée, symétrie, chaque palier change
  la silhouette, bandes = grille), `tsc`, planche des paliers rendue en PNG et relue, capture Edge
  headless 390 px (Force 87 → palier 4, Endurance 42 → 1, Constance 63 → 1). Publié en 0.1.18,
  APK servi par le partage = empreinte de `version.json`. Halo (Constance ≥ 75) pas vu en capture.
  Pas vu sur le S23.

## Prochaine étape

1. **Synchro** : compte `exzifit` + dossier + mot de passe d'application créés le 2026-10-14
   (README). Reste : Tom saisit le mot de passe dans Réglages › Synchro (PC et téléphone), puis
   premier essai réel : séance au téléphone → visible au PC ; correction au PC → téléphone.
   Constat resté vrai : l'envoi des **sauvegardes** ne part qu'au lancement (1×/jour).
2. Essai 0.1.21 à la salle : vibration (3 × 1 s), chiffres centrés, remplacement (top, séries
   gardées), carte « Rattrapage ».
3. Personnage : avis sur le dessin et les seuils avec les vraies stats.

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
| 2026-10-13 | Partage des sauvegardes en « can edit » (remplacé : dépôt seul, voir plus bas) | choix de Tom (dépôt seul introuvable dans l'UI) |
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
| 2026-10-13 | Bouton retour Android = lien « ‹ » de l'écran (saisie/choix d'exo → jour, résumé → fermé, Réglages → Séance) ; à la racine, Android ferme l'app (0.1.11) | retour de Tom : retour fermait l'app partout ; écoute `onBackButtonPress` posée seulement en sous-vue (`src/boutonRetour.ts`), pas d'historique navigateur à synchroniser |
| 2026-10-13 | Partage des sauvegardes en dépôt seul (« File request »), un nom de fichier par contenu (0.1.12) | Tom : documenter le risque « c'est pas ouf » ; le lien est dans l'APK public, il ne doit permettre que d'envoyer |
| 2026-10-13 | Stats : Force relative (e1RM ÷ poids, usure après 21 j), groupes = séries dures plafonnées à 10/sem, Endurance = moyenne des groupes, Constance = tranches de 7 j sur 8 semaines au seuil du programme | choix de Tom sur la proposition `docs/stats.md` ; rien ne récompense volume poubelle, PR risqués ni série de jours |
| 2026-10-13 | Stat Progression (1RM estimé 14 j contre 28–42 j, part des exos qui montent) + écart par exo | Tom : il faut une motivation de progression ; un exo comparé à lui-même, pas de référence à inventer, baisse si on stagne |
| 2026-10-13 | Poulie double = drapeau de séance, journal en charge effective (0.1.15) | Tom change de salle ; aucun calcul à adapter, un seul historique par exo |
| 2026-10-13 | Stats dans un 3e onglet « Perso » + carte des écarts dans le résumé (0.1.13) | l'accueil reste « quoi faire aujourd'hui » ; le résumé ne montre que ce qui a bougé |
| 2026-10-13 | Pesée saisissable dans l'onglet Perso, « pesée manquante » aussi dans le titre du panneau 1RM (0.1.17) | Tom : « pesée manquante » affiché sans aucun endroit visible pour la noter (champ caché dans le panneau 1RM, absent en fin de bloc) |
| 2026-10-13 | Personnage : paliers Force 40/55/70/85, Endurance 25/50/75, Constance 50/75 ; comparaison avec il y a 8 semaines (0.1.18) | seuils de Force serrés au niveau intermédiaire pour qu'un progrès se voie en quelques mois ; à revoir sur données réelles |
| 2026-10-14 | Synchro PC ↔ téléphone par un etat.json dans un dossier Nextcloud privé, utilisateur dédié + mot de passe d'application saisi dans Réglages | Tom veut consulter et modifier sur le PC ; le lien des sauvegardes est public (APK) et en dépôt seul, il ne peut pas servir à lire |
| 2026-10-14 | Remplaçants par schéma de mouvement, séries de l'exo remplacé gardées, rattrapage sous condition de repos | retours de la 1re séance à la salle |

**Noms anglais et propositions de programmes (2026-10-13, 0.1.19)** — demande de Tom :
- Noms des exercices en anglais dans l'app (`exercices.ts`, champ `nom` seul ; les identifiants
  et le journal ne changent pas). 67 tests Vitest, `npm run build`, publié en 0.1.19. Pas vu sur le S23.
- Quatre programmes proposés (artefact « Programmes ExziFit », claude.ai/artifact/4jAraXnA7YCzaBMaDgFzcn) :
  A Push/Pull/Legs, B Force & physique haut/bas, C Endurance full body, D Superset express.
  Contrainte de Tom : 1 h maximum par séance, moins de postes plutôt que moins de repos ; durées
  calculées (35 à 52 min). En attente du choix de Tom. À coder ensuite : ~9 exercices neufs,
  sélecteur de programme sur l'accueil (`PROGRAMME` est en dur dans programme.ts).
  Page v3 : pourquoi de chaque jour et exercice, niveau de preuve vérifié (recherches web) :
  fréquence peu utile au muscle à volume égal (Pelland 2024) ; échec : études divergentes
  (Refalo / Robinson 2023) → isolation finie à 0–1 RIR en hypertrophie, gros mouvements 1–2 RIR.
  « Ajouter un exo » existe déjà en séance de programme (Seance.tsx) : à garder dans les nouveaux.
- **0.1.20** (accord de Tom, « fais au mieux ») : Bloc Force gardé comme programme de force (la
  proposition B le dégradait : bench 1×/sem, tractions et militaire hors %), deux retouches pour
  les ischios (6 → 9 séries/sem) : J2 `leg-curl-assis` (ex-allongé, proposé en remplacement),
  J4 `leg-curl-assis` 3 × 10–12 obligatoire à la place du leg extension optionnel (pas de roumain
  après le soulevé lourd). Exo `leg-curl-assis` ajouté. 67 tests, tsc, build verts ; publié.
  Pas vu sur le S23. Les autres programmes (A, C, D) restent à coder si Tom les choisit.

**Retours de la salle (2026-10-13, 0.1.21)** — liste de Tom après sa première séance :
- **Chiffres de saisie décalés** : calés à droite d'une case de 5,2 ch, « REPS » coupé à 360 px.
  Chiffre centré sur toute la case, unité dessous (`styles.css`, `.reglage`).
- **Vibrations plus longues** : le plugin ne sait que la vibration par défaut. Canal `repos-long`
  créé par `MainActivity.kt` (3 × 1 s, ≈ 3,8 s), ancien canal `repos` supprimé. Un motif de canal
  est figé à sa création : le changer = changer l'identifiant (Kotlin + `minuteur.ts`).
- **Remplacement guidé** : champ `mouvement` sur chaque exo (17 schémas), `remplacants()` :
  alternatives du programme, même schéma (« top »), mêmes muscles, puis « Autres exercices ».
  13 exos ajoutés (Back squat `force`, réf. 2,5 ; Leg press, Goblet squat, Split squat, Walking
  lunge, Romanian deadlift, DB bench, Machine chest press, Seated DB press, Lat pulldown, Seated
  cable row, Seated calf raise, Hanging leg raise).
- **Séries gardées au remplacement** : `faitesMembre` compte la chaîne des remplacements (1 hack
  squat sur 5 puis squat → « Série 2/5 » au squat, qui garde sa propre progression).
- **Rattrapage** : `aRattraper()` + champ `rattrapage` de la séance (voir le modèle) ; carte sur
  l'accueil, cochée par défaut sur un jour optionnel (J6), à cocher sur un jour lourd ; un poste
  dont le repos manque est affiché « plus tard » avec la raison (`reposManquant` : règle `ecart`,
  ou 48 h entre gros mouvements de jambes sur un muscle commun — squat → deadlift).
- Vérifié : 75 tests Vitest (8 nouveaux : remplaçants, rattrapage), `tsc`, `npm run build`,
  captures Edge headless 360 px (saisie, remplacement hack → squat, rattrapage J4 sur J5 avec
  deadlift bloqué par un squat à 12 h). Vibration : pas testable sur PC, à confirmer sur le S23.
- Limites : le remplaçant en % du 1RM sans historique repart de la barre (montée guidée) ; le
  rattrapage ne regarde que les postes à zéro série (pas les postes à moitié faits).

**Synchro PC ↔ téléphone (2026-10-14, 0.1.22)** — voir le README et le modèle, « Synchro » :
- `synchro.rs` : WebDAV authentifié sur `ExziFit-sync/etat.json` (Basic + mot de passe
  d'application, `If-Match` / `If-None-Match: *`), hors ligne = silence, 401 / 404 / 409 expliqués.
  Compte dans `acces-synchro.json` hors de `donnees/` (jamais dans les sauvegardes ni renvoyé au
  front). `sauvegarde_synchro` : copie `sauvegardes/sync-AAAAMMJJ-HHMMSS/` avant chaque fusion (20 gardées).
  Dépendance `base64 0.22` (déjà tirée par ureq, même version).
- `synchro.ts` : `fusionner` (pure) ; séance corrigée > jamais corrigée, puis `modifie` le plus
  récent (jamais comparé à l'heure de fin : un premier essai le faisait, le test à deux appareils a
  montré qu'une correction datée avant la fin perdait) ; suppressions (`suppressions.json`) ;
  blocs `modifie` (posé par `ecrireBlocs`), pesées `le`. Séances remplacées → corbeille.
- App : synchro au lancement, au retour (1/min), 5 s après une écriture synchronisée
  (`quandEcrit` dans fichier.ts) ; données reçues → écrans remontés, sauf en séance ou au Journal
  (bandeau « Actualiser »). Réglages : compte (serveur prérempli depuis le partage des sauvegardes),
  état de la dernière synchro, « Synchroniser maintenant ».
- Vérifié : 85 tests Vitest (10 nouveaux : 7 de fusion, 3 de bout en bout avec deux appareils et un
  serveur à ETag simulés), 11 tests Rust, `tsc`, `npm run build`. **Pas testé contre Nextcloud**
  (le compte n'existe pas encore), ni l'écran Réglages (absent dans le navigateur, visible dans
  `tauri dev` seulement).
- Limites : une séance en cours n'est pas synchronisée (normal) ; un bloc changé sur les deux
  appareils entre deux synchros → le plus récent gagne en entier (pas de fusion des 1RM un à un).

**Synchro en réel (2026-10-14, 0.1.23 et 0.1.24)** — compte `exzifit` créé sur la VM `services`
(dossier dans ses propres fichiers, pas de partage ; README). Premier essai : envoi refusé en
boucle (412) : Apache, dans le conteneur Nextcloud, compresse la réponse et ajoute `-gzip` à
l'ETag, que Nextcloud ne reconnaît plus en `If-Match`. 0.1.23 : `Accept-Encoding: identity` et
`etag_fort` (retire `-gzip` et `W/`). Vérifié dans le journal du proxy : PUT 204 depuis le
téléphone, `etat.json` = 3 séances, 2 blocs, 1 pesée.
- Trouvé dans les données : la séance J1 du 2026-10-14 02 h 31 a ouvert un **second bloc**
  (`2026-10-14-bloc-force`) alors que celui du 13 était ouvert (l'écran ne le voyait pas ; cause
  exacte non établie). 0.1.24 : `assurerBloc` relit `blocs.json` et reprend le bloc ouvert.
  Réparation des données (J1 rattachée au bloc du 13, bloc du 14 retiré) : à faire avec l'accord de Tom.
