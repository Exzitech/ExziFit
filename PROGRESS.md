# PROGRESS — ExziFit

Journal de bord. Lire [CLAUDE.md](CLAUDE.md) d'abord.
Mis à jour à chaque fin d'étape et avant tout `/clear`.

## Statut : 0.1.43 (marge sous la barre d'état Android ; 0.1.42 : personnage revu sur données réelles : palier de Force 100, Constance des débutants ; 0.1.41 : trois langues ; 0.1.40 : aperçu des stats à la bienvenue, éditeur de programmes ; 0.1.39 : icône = le personnage ; 0.1.38 : fusion avec la synchro ; 0.1.37 : échauffement spécifique, sans jumping jacks ; 0.1.36 : poids à vide signalé en saisie ; 0.1.35 : échauffement 3 min, page Programmes, sauvegarde Android), retours de salle traités ; synchro PC ↔ téléphone (0.1.22–0.1.24, autre branche) fusionnée

**Dev et prod, préparation Google Play (2026-10-17)** — README, « Dev et prod » ; démarches :
[docs/play-store.md](docs/play-store.md). Deux apps depuis le même code (`EXZIFIT_CANAL`) :
ExziFit Dev (`.dev`, Nextcloud, `npm run publier`) et ExziFit prod (AAB, `npm run publier-play`,
depuis `main` propre, tag `vX.Y.Z`). Prod sans mise à jour Nextcloud, sans envoi ni synchro ;
`SCHEDULE_EXACT_ALARM` au lieu de `USE_EXACT_ALARM` (bandeau « Autoriser ») ; plus d'Android TV.
Décidé avec Tom : garder la clé actuelle comme clé de signature Play. À faire par Tom : installer
ExziFit Dev, **tester le minuteur téléphone verrouillé** (nouvelle permission), créer le compte
Play, branche `dev`, adresse de contact dans [docs/confidentialite.md](docs/confidentialite.md).

**Retours de Tom après essai (2026-10-15)**, triés et précisés avec lui ; ordre de travail :
1. ~~Le 0 se décale à la saisie ; exo en option signalé dans « Suivant » + message changeant~~ (0.1.25).
2. ~~**Matériel** : variantes Smith / haltères, salles et réglages de machine~~ (0.1.26).
3. ~~**Échauffement conseillé** en tête de séance~~ (0.1.27).
4. ~~**Minuteur visible hors de l'app** : notification persistante avec décompte~~ (0.1.28).
5. ~~**Coefficient de Force par exo**~~ (0.1.29) : valeurs à juger par Tom ([docs/stats.md](docs/stats.md)).
6. ~~**Changer de programme**~~ (0.1.30) : les trois (A, C, D) codés, à essayer par Tom.
7. ~~**Homme / femme**~~ (0.1.31) : facteurs de Force et dessin à juger par Tom.
8. ~~**App pour les potes** : onboarding, export manuel, envoi Nextcloud réservé à Tom~~ (0.1.32).
Écarté : « sticky notes » (concernait une autre app).

**Synchro PC ↔ téléphone** (0.1.22, branche parallèle fusionnée le 2026-10-15) : compte Nextcloud
créé, mot de passe à saisir dans Réglages › Synchro ; jamais testée contre le vrai serveur.

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

**Choix du programme (2026-10-15, 0.1.30)** — point 6 des retours. Les trois programmes proposés
sont codés à côté du Bloc Force, tels que dans [docs/propositions-programmes.html](docs/propositions-programmes.html) :
- `push-pull-legs.json` (A, 6 jours, principal des jours A en % : S1 70 % 4 × 8 → S4 77,5 % 4 × 6,
  S5 décharge 65 % 3 × 6 ; jours B en double progression), `endurance.json` (C, 4 jours, ancre
  3 × 5 à 75–80 %, une seule semaine répétée), `superset-express.json` (D, 4 jours, tout en
  double progression). Choix faits sans Tom : semaines de A (la page ne donnait que « 70 → 77,5 % »),
  RIR visé 1 sur l'isolation de A et D, 2 ailleurs ; aucune règle d'écart dans les trois.
- Exos neufs : Romanian deadlift, Seated calf raise, Cable fly, Incline dumbbell curl,
  Neutral-grip lat pulldown, Cable pullover (coefficients de Force dans [docs/stats.md](docs/stats.md),
  posés sans données). « Seated dumbbell press » = l'exo existant Dumbbell shoulder press.
- Accueil : carte repliée « Changer de programme » (grille 2 × 2) sous le titre ; le choix va dans
  `reglages.json` (`programme`). Chaque programme garde son bloc ouvert : revenir au Bloc Force
  reprend sa rotation. La séance note `programme` (absent = Bloc Force, pas de migration) ; Journal,
  résumé et reprise lisent le jour dans le programme de la séance (`jourDeSeance`).
- Programme d'une seule semaine : pas de fin de bloc (`blocFini`), sélecteur de semaine masqué.
  Sans exo en % : la carte « 1RM du bloc » devient « Poids de corps ». Repos < 1 min affiché « 45 s »
  (avant : « 0 min 45 »).
- Vérifié : 83 tests Vitest (3 nouveaux : programmes cohérents — exos connus, schémas présents
  chaque semaine, jours uniques ; séance sans `programme` ; programme d'une semaine jamais fini),
  `tsc`, `npm run build`, parcours Edge headless 390 px (Capacité de travail choisi →
  `reglages.json` écrit, J3 démarré → `en-cours.json` avec `programme: "endurance"`, rechargement =
  reprise sur Weighted pull-up 3 × 5 75–80 % ; Haut / bas express : 4 jours, sans semaines ; retour
  au Bloc Force). Publié en 0.1.30, partage vérifié au curl (version.json 0.1.30, empreinte de l'APK
  identique). Pas vu sur le S23.
- Limites : la Constance prend le seuil du programme choisi (moitié de ses jours) ; un id de
  programme inconnu retombe sur le Bloc Force. Le Journal n'affiche pas le nom du programme
  (« J1 · Push A » suffit à les distinguer).

**Homme / femme (2026-10-15, 0.1.31)** — point 7 des retours. Détail dans [docs/stats.md](docs/stats.md) :
- Réglages → « Personnage » : Homme / Femme, écrit `sexe` dans `reglages.json` (absent = homme,
  pas de migration).
- Force : au lieu de seuils de personnage différents, la **référence** de chaque exo est multipliée
  pour une femme (× 0,8 si un groupe du bas du corps est principal, × 0,65 sinon). Force 100 = très
  avancée dans son sexe, seuils du dessin communs. Facteurs donnés de mémoire (tableaux Strength
  Level), non vérifiés sur source.
- Dessin femme : même grille et mêmes paliers, plus cheveux longs, brassière à l'accent, hanches
  (short + 1 pixel). `grille(paliers, sexe)`.
- Vérifié : 90 tests Vitest (1 Force femme, tests de grille passés sur les deux sexes, 1 « silhouette
  différente »), `tsc`, `npm run build`, planche des paliers des deux sexes rendue en PNG et relue,
  parcours Edge headless 390 px (Réglages → Femme → `reglages.json` avec `"sexe": "femme"`, onglet
  Perso = dessin femme). Publié en 0.1.31, partage vérifié au curl (version.json 0.1.31, empreinte
  de l'APK identique). Pas vu sur le S23.
- Limite : le choix est dans les réglages seulement ; l'onboarding des potes (point 8) le reprendra.

**App pour les potes (2026-10-15, 0.1.32)** — point 8 des retours. Voir le README, « Données » :
- **Écran de bienvenue** (`Bienvenue.tsx`) quand ni `reglages.json` ni journal n'existent :
  prénom, poids de corps, homme / femme, programme ; la nav est masquée jusqu'à « Commencer ».
  Le prénom devient le titre de l'onglet Perso, modifiable dans les réglages.
- **Envoi Nextcloud réservé à Tom** : `envoi: false` écrit par la bienvenue ; absent = actif
  (l'installation de Tom a déjà ses réglages, aucune migration). Filtre dans `App.tsx`.
- **Export manuel** : Réglages → « Exporter les données » → partage Android d'un
  `exzifit-AAAA-MM-JJ.json` (format du paquet Nextcloud, données vivantes sans `sauvegardes/`).
  Plugin Kotlin `PartagePlugin` sur le FileProvider existant ; pas de dépendance.
- CLAUDE.md : périmètre v1 = Tom et quelques potes.
- Vérifié : `cargo test` (9, dont l'export : copies et `.tmp` exclus), 90 tests Vitest, `tsc`,
  `npm run build`, parcours Edge headless 390 px (stockage vide → bienvenue → Léa, 62.5, Femme,
  PPL → `reglages.json` avec `envoi: false`, `poids.json` écrit, titre Perso « Léa », export
  téléchargé, relance sans bienvenue ; réglages sans `envoi` → pas de bienvenue, ligne Nextcloud).
  Publié en 0.1.32, partage vérifié au curl (version.json 0.1.32, empreinte de l'APK identique).
  Pas vu sur le S23 : partage Android et installation neuve à essayer.
- Limites : import ajouté en 0.1.33 ; le
  lien de dépôt reste extractible de l'APK (déjà le cas) ; un pote qui installe garde le Bloc Force
  de Tom comme programme par défaut proposé.

**Restaurer un export (2026-10-15, 0.1.33)** — limite de la 0.1.32. Voir le README, « Restaurer un export » :
- « Restaurer un export » sur la bienvenue (« Nouveau téléphone ? ») et dans Réglages → Données.
  Sélecteur de fichiers par `<input type="file">` (géré par la WebView de wry 0.55, sans plugin
  Kotlin ni dépendance), résumé « Export du … (prénom) : n séances », confirmation, rechargement.
- Rust `importer` : paquet entier contrôlé avant toute écriture (format 1, chemins `valider`, chaque
  `.json` lisible), copie des données actuelles dans `sauvegardes/avant-import-AAAA-MM-JJ-HHMMSS/`
  (ni élaguée ni envoyée), puis remplacement (pas de fusion).
- Vérifié : `cargo test` (10, dont l'import : refus sans écriture, copie, remplacement, aller-retour
  export → import identique), 92 tests Vitest (`resumerExport`), `tsc`, `npm run build`, parcours
  Edge headless 390 px (bienvenue → export de Léa posé par CDP → résumé → Restaurer → plus de
  bienvenue, Perso « Léa » ; Réglages : fichier invalide → message, bon fichier → avertissement
  « Remplace… », Annuler). Publié en 0.1.33, partage vérifié au curl (version.json 0.1.33,
  empreinte de l'APK identique). Pas vu sur le S23 : sélecteur Android à essayer.
- Limites : revenir sur un import = recopier la copie `avant-import-…` à la main (pas d'écran) ;
  importer l'export de Tom sur un autre téléphone réactive l'envoi Nextcloud (`envoi` absent).

**Bienvenue sans présélection (2026-10-15, 0.1.34)** — choix de Tom : un pote ne reçoit plus le
Bloc Force par défaut, « Commencer » reste grisé tant qu'aucun programme n'est choisi.
`PROGRAMME_DEFAUT` ne sert plus qu'au repli (réglages sans `programme`, comme chez Tom).
Vérifié : `tsc`, 92 tests Vitest, `npm run build` ; publié, partage vérifié au curl
(version.json 0.1.34, empreinte de l'APK identique). Pas vu dans un navigateur ni sur le S23.

**Retours du 2026-10-15 au soir (0.1.35)** — trois demandes de Tom :
- **Échauffement** trop long : 3 min au plus, sans matériel. `preparation` (programme.ts) =
  jumping jacks 30 s + au plus 5 mouvements au poids du corps de 30 s, choisis par les muscles
  du jour (cardio machine, bâton, élastique et barre retirés).
- **Aperçu des stats** au changement de programme, sur une page à part : `Programmes.tsx`, ouverte
  par « Changer de programme › » sur l'accueil (remplace la carte repliée), retour Android compris.
  Groupes et Endurance « aujourd'hui → après 4 semaines de ce programme », séries lourdes / sem.
  pour la Force (pas de chiffre : elle dépend des charges), seuil de Constance. `apercu` (stats.ts),
  [docs/stats.md](docs/stats.md), « Aperçu d'un programme ».
- **Données perdues à la réinstallation** : désinstaller efface le dossier privé, `sauvegardes/`
  compris. Choix de Tom : « comme n'importe quelle app du Play Store » = sauvegarde Android
  (Google), restaurée d'elle-même à la réinstallation. Règles explicites limitées à `donnees/`
  (manifeste + `res/xml/sauvegarde_android12.xml` / `11.xml`) ; README, « Sauvegarde Android ».
  Les données d'avant la réinstallation restent récupérables par « Restaurer un export » avec le
  dernier fichier du dossier Nextcloud `ExziFit-backups`.
- Vérifié : 95 tests Vitest (3 nouveaux : 3 min / sans matériel sur chaque jour de chaque
  programme ; aperçu = `stats` sur 4 semaines simulées ; options non comptées), `tsc`, build,
  captures Edge headless 390 px de chaque écran (artifact : https://claude.ai/artifact/Ba8SgVnmfDhRnQjjmx4sGy).
- Limites : sauvegarde Android **non vérifiée** (téléphone non branché) ; Android choisit le moment
  (≈ 24 h, en charge, Wi-Fi) et ne restaure que si « Sauvegarde Google » est active ; restauration
  d'un APK installé hors Play Store non confirmée par la doc trouvée. À tester :
  `adb shell bmgr backupnow com.exzitech.exzifit`, désinstaller, réinstaller.

**Poids à vide signalé (2026-10-15, 0.1.36)** — retour de Tom : sur la presse, rien ne disait que le
poids à vide manquait. Machine à disques sans poids à vide noté dans la salle du jour : le réglage
(`ReglageMachine`, Seance.tsx) s'ouvre d'office avec un avertissement, champ prêt à remplir ; replié
une fois noté. Exo chargé jamais fait à 0 kg : « Jamais fait : mets ta charge de départ… » en alerte.
Vérifié : `tsc`, 95 tests, build, Edge headless 390 px (Leg press, Haut / bas express Bas B :
avertissement, 76 tapé → `salles.json` `presse-cuisses.aVide: 76`, réglage replié en « 76 kg à vide »).

**Échauffement spécifique (2026-10-15, 0.1.37)** — retour de Tom : personne ne fait de jumping jacks à la
salle. Jumping jacks retirés de `preparation` ; la barre à vide passe de ×10 à ×15 en tête des
séries d'approche (`echauffement`) et tient lieu d'échauffement général. Sources : l'échauffement
spécifique a le meilleur appui pour le 1RM, le général avant lui est inconstant (revue de 11 études) ;
les guides de coaching montent barre ×10–20 puis paliers à reps décroissantes pour ne pas
fatiguer. ×30 écarté pour cette raison. Vérifié : `tsc`, 95 tests Vitest. Publié en 0.1.37. Pas vu sur le S23.

**Personnage sur données réelles (2026-10-17, 0.1.42)** — point 3 des prochaines étapes. Données lues
dans `etat.json` (synchro, copie dans le dossier temporaire, lecture seule) : 4 séances du 13 au 15,
pesées 90 kg. Stats au 17 : Force 94, Endurance 10, Constance 12,5. Deux constats, tranchés par Tom :
- **Force saturée** : 94 dès la 3e séance, donc dernier palier (85) sans marge, et ~13 semaines
  d'arrêt pour en perdre un. Ajout d'un **palier à 100** : trapèzes (cou élargi) et veine en biais
  sur l'avant-bras ; épaules plafonnées au palier 4 (le corps occupe déjà 22 px sur 24). Seuils
  du bas inchangés (les potes seront vers 30–50).
- **Constance des débutants** : avec 8 tranches fixes, un nouveau assidu restait avachi 4 semaines.
  Dénominateur = tranches écoulées depuis la 1re séance, entre 4 et 8 : Tom passe à 25, à 50
  (posture droite) s'il tient 3 séances cette semaine.
- Bloc Force suivi en entier → Endurance 74,3 (aperçu), juste sous le palier 3 (75) : mollets à 0,
  abdos et avant-bras à 30. Pas changé, c'est le programme qui le dit.
- Vérifié : `tsc`, 129 tests Vitest (1 nouveau : Constance débutant ; grilles testées jusqu'au
  palier 5), build ; rendu texte des grilles F4 / F5 regardé. Publié en 0.1.42, version.json et
  empreinte de l'APK vérifiées au curl. Pas vu sur le S23.
- Remarqué : le PC n'a pas de mot de passe de synchro (`acces-synchro.json` absent), ses données
  datent des essais du 13 ; une séance d'essai (couché 20 × 9, le 13 à 6 h 14) est dans le vrai
  journal et compte pour la Constance et les groupes.

## Prochaine étape

1. **Synchro** : marche au téléphone (`etat.json` à jour le 2026-10-17). Reste le PC : saisir le
   mot de passe dans Réglages › Synchro, puis vérifier séance au téléphone → visible au PC.
   Constat resté vrai : l'envoi des **sauvegardes** ne part qu'au lancement (1×/jour).
2. Essai 0.1.21 à la salle : vibration (3 × 1 s), chiffres centrés, remplacement (top, séries
   gardées), carte « Rattrapage ».
3. Personnage : voir le palier 5 de Force sur le S23 (onglet Perso) ; rejuger Endurance et Constance
   après 4 semaines de vraies données.

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
| 2026-10-17 | Freemium certain, après la v1 : partage, thèmes en plus, synchro, analyses longues payants ; données et personnage jamais payants (CLAUDE.md, « Freemium ») | Tom : une app de qualité en gratuit, des conforts de vie en payant, sans abus |
| 2026-10-17 | Pro en achat unique (Android d'abord), abonnement seulement pour ce qui coûte un serveur ; synchro par Drive / iCloud avant tout serveur | ce qui est vendu ne coûte rien par mois ; pas de compte ni de données de santé chez nous |

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

**Saisie et fin d'exo (2026-10-15, 0.1.25)** — retours de salle :
- Champs charge / reps (`Champ` dans Seance.tsx) : le toucher sélectionne la valeur, la frappe la
  remplace ; vidé puis quitté = valeur d'avant.
- Exo en option : badge à côté du nom en saisie, « en option · si tu as encore du jus » sous
  « Suivant : … ». Message de fin d'exo (`encouragement`, programme.ts) : record de 1RM estimé,
  sinon kg ou reps au-dessus de la dernière fois, sinon une phrase sans chiffre choisie par la
  séance ; jamais de reproche ni de série de jours.
- Vérifié : 70 tests Vitest (3 nouveaux), `tsc`, `npm run build`, parcours Edge headless 390 px
  (J1, pushdown 32,5 → tapé 32, 3 séries → « Record : 1RM estimé 44 kg (avant 42) » + Suivant
  incliné en option). Publié en 0.1.25. Pas vu sur le S23.
- **Version** : le partage annonçait déjà 0.1.24 alors que le dépôt était à 0.1.20 ; 0.1.21–0.1.24
  ne sont pas dans git (publiées depuis l'autre PC ?). La 0.1.25 est construite depuis le dépôt.

**Salles et réglages de machine (2026-10-15, 0.1.26)** — retours de salle (Smith 11 kg, presse 76 kg,
poulie simple / double incompréhensible). Choix de Tom : réglages **par salle**, poids à vide
**appliqué au passé**, noter **les disques seuls**. Voir [docs/modele-donnees.md](docs/modele-donnees.md), « Salles » :
- `src/donnees/salles.ts` : `salles.json`, `exerciceEn` (exo monté : `aVide`, `poulie`),
  `normaliser` (séances réécrites en mémoire dans les unités d'une salle, ou en charge réelle pour
  stats et résumé). programme.ts : `totalDe` / `chargeDe` = kg ÷ moufle + chariot (+ corps), arrondi
  au pas en disques ; 1RM, %, recalage, retour, échauffement, tonnage passent par là.
- Séance : champ `salle` ; journal = ce qui se lit (disques, pile). Anciennes séances : première
  salle, `poulie: 2` = charge réelle (déjà ÷ 2). Aucun fichier réécrit ; séance en cours d'avant
  les salles convertie à la reprise.
- Écrans : salle choisie sur l'accueil (si plusieurs), ajoutée / renommée dans Réglages ; ligne
  repliée « Ma salle · 50 kg à vide ▾ » sous le nom de l'exo (Normale / Moufle sur une poulie) ;
  disques par côté sur les machines à disques. Bascule « Poulie simple / double » retirée.
- Exos neufs : Smith overhead press, Dumbbell shoulder press, Smith bench press, Smith squat,
  Leg press (Smith / presse / hack squat en `disques`).
- Vérifié : 79 tests Vitest (9 nouveaux, `salles.test.ts`), `tsc`, `npm run build`, parcours Edge
  headless 390 px (pushdown ancien en moufle 30 → 60 affiché, 62,5 × 10 → record 44 (avant 42),
  tonnage 313 ; hack squat 50 à vide → échauffement 10 / 35 / 60, disques 25 + 20 + 2,5 ; salle
  ajoutée « Basic-Fit », choisie sur l'accueil, notée dans `en-cours.json`). Publié en 0.1.26.
  Pas vu sur le S23.
- Limites : `REFERENCES_FORCE["hack-squat"]` (3 × poids de corps) fixé sans chariot : la Force
  monte d'un coup quand le poids à vide est noté — à revoir avec le point 5 (coefficient de Force).
  Un 1RM du bloc saisi en disques seuls avant le réglage reste sous l'estimé (sans effet : le max
  des deux sert). Les séances d'avant les salles prennent toutes la première salle.

**Échauffement conseillé (2026-10-15, 0.1.27)** — carte « Échauffement · ≈ n min » dépliée sur
l'accueil, sous l'aperçu du jour (aucun geste en plus) : `preparation` (programme.ts) = cardio léger
5 min + mobilité dynamique choisie par les muscles principaux des exos du jour (9 mouvements,
≈ 1 min chacun), puis renvoi aux séries d'approche déjà calculées à la saisie. Vérifié : 80 tests
Vitest (1 nouveau), `tsc`, build, capture Edge headless 390 px (J1 : bras / épaules, 8 min ;
J2 : squat, jambes, good morning, mollets, 9 min). Publié en 0.1.27. Pas vu sur le S23.

**Décompte du repos hors de l'app (2026-10-15, 0.1.28)** — `ReposPlugin.kt` : à chaque repos, une
notification « Repos » en cours (id 2, canal muet « Repos en cours ») avec chronomètre système en
décompte (`setUsesChronometer` + `setChronometerCountDown`), visible dans le volet et sur l'écran
verrouillé, effacée d'elle-même à la fin (`setTimeoutAfter`) ; un tap rouvre l'app. Rien ne tourne
côté app : pas de service au premier plan. La vibration reste la notification programmée (id 1).
Retirée à la fin de séance. Rust : `repos.rs` (Android seulement), appelé par `minuteur.ts`.
Vérifié : 80 tests Vitest, `tsc` + build, `cargo test`, APK release compilé (Kotlin compris) et
publié en 0.1.28. Pas vu sur le S23 : à juger (décompte qui défile écran verrouillé, disparition
à la fin, pas de son en double). Piste si besoin : « Live Update » d'Android 16 (puce dans la barre
d'état), demande une permission en plus.

**Coefficient de Force par exo (2026-10-15, 0.1.29)** — `Exercice.force` passe de `true` à
`{ ref, poids }` (`exercices.ts`, table `REFERENCES_FORCE` de stats.ts supprimée) ; Force = moyenne
des scores exo **pondérée** : 1 pour les cinq gros mouvements (valeurs inchangées), 0,5 pour les
polyarticulaires secondaires, 0,25 pour l'isolation ; dips / australiennes sans lest et farmer's
walk n'entrent pas. Haltères comptés par haltère. Table dans [docs/stats.md](docs/stats.md), « Force ».
- Vérifié : 80 tests Vitest (1 nouveau : moyenne pondérée ; celui « chaque exo a une référence »
  retiré, le type l'assure), `tsc`.
- Limites : références des machines et poulies posées sans données (indicatives, d'où le
  coefficient faible) ; la Force de Tom va bouger dès la mise à jour (les accessoires entrent dans
  la moyenne). Hack squat : la référence 3 s'applique maintenant à la charge réelle (chariot compris).

**Fusion de deux branches (2026-10-15, 0.1.38)** — GitHub avait `972578c` (0.1.21–0.1.24 : synchro PC ↔
téléphone, rattrapage des postes sautés, remplaçants classés par schéma de mouvement + 9 exos, un
seul bloc ouvert par programme), parti de `9b09ece` comme la branche locale (0.1.21–0.1.37). Fusion :
les exos gardent le format local (`force: { ref, poids }`, `disques`) et prennent `mouvement` ;
`developpe-halteres-assis` du distant écarté (doublon de `developpe-militaire-halteres`) ; références
de Force des nouveaux exos posées sans données (docs/stats.md). Rattrapage et chaîne de
remplacements branchés sur le programme de la séance et le contexte de salle. Vérifié : `tsc`,
113 tests Vitest, `cargo check`, `cargo test`, build ; publié en 0.1.38, pas vu sur le S23. Limites : la synchro ne transporte ni `salles.json` ni
`reglages.json` ; « Restaurer un export » puis synchro peut refusionner les séances de l'autre appareil.

**Icône (2026-10-16, 0.1.39)** — Android affichait l'icône Tauri par défaut : l'ancienne icône
(haltère, `icone/exzifit.svg`) n'était générée que dans `src-tauri/icons` (`-o`), jamais dans
`gen/android`. Nouvelle icône = le personnage de l'onglet Perso (Force 4, Endurance 3, Constance 1,
couleurs Braise), dessiné par `scripts/icone.ts` depuis `avatar.ts` ; `npm run icone` écrit
`icone/` (icône pleine, premier plan transparent, manifeste) puis `tauri icon` régénère bureau et
mipmaps Android, avec icône adaptative (premier plan réduit au disque visible, fond `#15110f` au
lieu du blanc par défaut). Vérifié : PNG xxxhdpi (premier plan et rond) et 128 px relus, `tsc`,
build, 113 tests Vitest ; publié en 0.1.39, version.json et empreinte de l'APK vérifiées au curl.
Pas vu sur le S23 (rendu selon le masque du lanceur Samsung).

**Aperçu à la bienvenue, éditeur de programmes (2026-10-16, 0.1.40)** — demande de Tom pour les potes :
- **Aperçu des stats** du programme choisi sur l'écran de bienvenue (sans « aujourd'hui → », pas
  d'historique) : composant `Apercu.tsx` sorti de `Programmes.tsx`, partagé avec l'éditeur.
- **Créer son programme** depuis la bienvenue (« Créer mon programme ») et la page Programmes
  (« Créer un programme », « Modifier » sur un programme perso). `EditeurProgramme.tsx` : nom, jours
  en rotation, objectif par jour (force / hypertrophie / endurance), exos du catalogue (menu par
  muscle, distance exclue), séries −/+, aperçu en direct. `programmes-perso.ts` : l'objectif donne
  fourchette, repos et RIR 2 (premier exo = principal) ; une semaine « Continu », sans règle ;
  `programmes.json` lu au lancement (`App.tsx`) et posé après les programmes du code
  (`poserProgrammesPerso`). Un jour retiré ne prête jamais son id (`dernierJour`).
- Vérifié : 119 tests Vitest (6 nouveaux : conversion, ids de jours, aller-retour, rotation et
  aperçu d'un programme perso), `tsc`, build, parcours Edge headless 390 px (bienvenue → aperçu PPL →
  éditeur : 2 jours, Endurance au 2e, série +1 → Enregistrer → programme choisi, prénom gardé →
  Commencer → `programmes.json` et `reglages.json` relus → relance : accueil sur le programme perso →
  Programmes → Modifier : renommé, J2 retiré, jour ajouté = J3). Corrigé en route : deux changements
  rapides du brouillon s'écrasaient (mises à jour fonctionnelles). Publié en 0.1.40, partage vérifié
  au curl (version.json 0.1.40, empreinte de l'APK identique). Pas vu sur le S23.
- Limites : `programmes.json` n'est pas synchronisé (un programme perso créé au téléphone est
  inconnu du PC, dont les séances retombent sur le Bloc Force) ; pas de suppression de programme,
  pas de superset ni de % du 1RM dans l'éditeur, fourchettes fixées par l'objectif ; retirer un jour
  déjà fait affiche ses séances en « Séance libre » au Journal.

**Trois langues (2026-10-17, 0.1.41)** — français, anglais, portugais du Brésil, demande de Tom pour les potes :
- **Choix** en tête de la bienvenue (proposée d'après le téléphone) et dans Réglages (section Langue) ;
  `langue` dans `reglages.json`, absent = langue du téléphone (l'installation de Tom reste en français).
- **Sans bibliothèque** : `src/i18n/` (`fr.ts` = référence et type `Textes`, `en.ts`, `pt.ts`), `t`
  en liaison vivante lue au rendu ; `appliquerLangue` (`src/langue.ts`) pose aussi les noms d'exos
  (portugais seulement : Supino reto… ; français et anglais gardent les noms anglais du catalogue) et
  les textes des programmes du code (dictionnaire texte français → traduction). Ids inchangés : aucun
  fichier réécrit. Nombres, % et dates au format de la langue ; jours affichés D1 en anglais et
  portugais, semaines W1 en anglais. Changer de langue dans Réglages remonte les écrans.
- **Natif** : notification de repos, canaux et titre du partage en ressources Android
  (`res/values`, `values-fr`, `values-pt`, fichier `textes.xml`) : langue du téléphone, pas de l'app.
- Vérifié : `tsc`, 128 tests Vitest (9 nouveaux : chaque texte de programme et chaque exo traduit,
  listes alignées, aller-retour de langue, nombres anglais), build, parcours Edge headless 390 px
  (téléphone en portugais : bienvenue → aperçu → accueil → saisie → RIR ; téléphone en français :
  passage en anglais, puis portugais depuis Réglages, retour au français, relance restée en
  portugais) ; APK compilé (Kotlin et ressources) et publié en 0.1.41, version.json et empreinte de
  l'APK vérifiées au curl. Pas vu sur le S23.
- Limites : programmes écrits dans l'app dans la langue de leur auteur ; erreurs techniques
  (fichier corrompu, synchro) en français ; portugais écrit sans relecture d'un Brésilien.

**Barre d'état Android (2026-10-17, 0.1.43)** — l'écran passait sous l'heure, le wifi et la batterie :
  `enableEdgeToEdge()` (MainActivity.kt) étend la WebView sous les barres système, et seul le bas
  réservait `env(safe-area-inset-bottom)`. `#racine` réserve désormais le haut et les côtés
  (`env(safe-area-inset-*)`, 0 sur PC), `.saisie` retranche le haut de sa hauteur mini. Build, 129 tests
  verts, publié en 0.1.43. Pas vu sur le S23.
