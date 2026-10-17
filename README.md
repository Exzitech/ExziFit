# ExziFit

App de musculation avec une couche RPG, Android d'abord. Pourquoi et périmètre :
[CLAUDE.md](CLAUDE.md) ; journal du chantier : [PROGRESS.md](PROGRESS.md) ;
format des données : [docs/modele-donnees.md](docs/modele-donnees.md).

Tauri 2 + React 18 / TypeScript / Vite 5.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | interface dans le navigateur du PC (http://localhost:1420), données en localStorage, sans notification |
| `npm run tauri dev` | fenêtre de bureau, vrais fichiers (`%APPDATA%\com.exzitech.exzifit\donnees`), sauvegarde et envoi réels (fichier `-dev`) : à utiliser pour tester sans téléphone |
| `scripts/lancer-bureau.vbs` | même chose sans console (raccourci « ExziFit (dev) » du bureau) ; sortie dans `%TEMP%\exzifit-dev.log`, boîte d'erreur si l'arrêt n'est pas normal |
| `npm test` | tests TypeScript (Vitest) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | tests Rust (chemins, sauvegardes) |
| `npm run build` | vérification des types + build de l'interface |
| `npm run publier` | APK **dev** release signé (« ExziFit Dev »), déposé sur Nextcloud ; l'app dev le propose au lancement |
| `npm run publier-play` | AAB **prod** pour Google Play, depuis `main` propre seulement ; pose le tag `vX.Y.Z` (voir « Dev et prod ») |
| `npx tauri android build --debug --target aarch64 --apk` | APK de debug, canal dev (clé de debug : ne met pas à jour l'app dev installée) |

Versions : les paquets npm `@tauri-apps/*` et les crates Rust sont figés à la même mineure
(`~2.11` / `~2.4`). La CLI refuse de compiler sinon ; monter les deux ensemble. Pas de
`cargo update` à l'aveugle : le `Cargo.lock` (repris du prototype) fixe des `tauri-runtime`
compatibles, une mise à jour en a tiré qui ne compilent plus avec tauri 2.11.

## Organisation

- `src-tauri/src/fichiers.rs` : seul accès disque, dans `donnees/` sous `app_data_dir()` (sur
  Android, `app_data_dir()` contient aussi le cache de la WebView ; jusqu'à la 0.1.1 les données
  y étaient à la racine, déplacées au premier lancement de la 0.1.2). Lecture, écriture atomique (`.tmp` + `sync_all`
  + renommage), liste, suppression, chemins validés (relatifs, minuscules, pas de `..`).
  Sauvegarde quotidienne au lancement dans `sauvegardes/AAAA-MM-JJ/` : 30 derniers jours +
  la première copie de chaque mois.
- `src/stockage.ts` : même interface côté front ; dans le navigateur, repli localStorage pour
  travailler l'interface sans téléphone.
- `src/donnees/` : fichiers du modèle (`format` contrôlé à la lecture, JSON indenté, dates locales).
  `exercices.ts` : catalogue de base (dans le code). `journal.ts` : séance en cours
  (`en-cours.json`, réécrit à chaque série) et journal mensuel (séance ajoutée à la fin), plus
  le calcul de la charge préremplie. `corrigerSeance` : correction ou suppression d'une séance
  terminée (identifiée par `debut`), l'ancienne version copiée d'abord dans `corbeille.json`.
- `src/ecrans/Bienvenue.tsx` : premier lancement d'une installation neuve (ni `reglages.json` ni
  journal) : langue (proposée d'après le téléphone), prénom, poids de corps, homme / femme, programme (avec l'aperçu de ses stats, ou
  « Créer mon programme ») ; écrit `reglages.json` avec `envoi: false` (pas d'envoi Nextcloud,
  voir « Données »).
- `src/ecrans/Programmes.tsx` : choix du programme et aperçu de ses stats (`Apercu.tsx`, partagé
  avec la bienvenue et l'éditeur). `EditeurProgramme.tsx` : écrire ou modifier un programme
  (jours en rotation, objectif force / hypertrophie / endurance par jour, exos du catalogue et
  nombre de séries) ; `donnees/programmes-perso.ts` : objectif → fourchette de reps, repos,
  RIR 2, premier exo principal ; enregistrement dans `programmes.json`, chargé au lancement.
- `src/ecrans/Journal.tsx` : onglet « Journal », séances terminées (la plus récente en haut) ;
  une séance ouverte = charge (affichée × 2 sur poulie double), reps et RIR modifiables par série,
  ✕ pour retirer une série, suppression de la séance en deux taps.
- `src/donnees/programme.ts` : programmes proposés (`src/donnees/programmes/*.json` : Bloc Force,
  Push / Pull / Legs, Capacité de travail, Haut / bas express ; puis ceux de `programmes.json`), choisi sur l'accueil (« Changer de programme », `reglages.json`), jour
  et semaine proposés (rotation, jour optionnel sauté après 5 jours lourds d'affilée), charge
  prescrite (% du 1RM du bloc relevé par la dernière séance, double progression, RPE), recalage
  série par série par le RIR (`recalage`), échauffement et disques par côté, avertissements des
  règles `ecart`, semaine de test (`etatTest`, `resultatTest`), fin de bloc (`blocFini`,
  `rmNouveauBloc`) et résumé de fin de séance (`bilan`).
  `bloc.ts` : `blocs.json` (1RM figés du bloc) et `poids.json` (poids de corps, pour les lestés et la Force).
- `src/ecrans/Seance.tsx` : accueil = jour proposé (semaine et jour modifiables d'un tap), aperçu
  des exos avec séries × reps, charge et repos, 1RM du bloc à saisir (vide = estimé depuis la
  dernière séance, sinon montée guidée en séance : paliers +20 % tant que le RIR est 4+, notés en
  échauffement). Mouvement principal et RPE : chaque RIR recale la série suivante (visé : 1 RIR au
  principal), une série ratée fait baisser ; les reps se corrigent sur l'écran du RIR. En séance, la saisie ouvre directement le
  premier exo à faire ; charge, reps et Valider sont en bas d'écran ; après Valider, le RIR
  remplace le bouton (un tap) et le repos du programme démarre ; exo fini → « Suivant : … ».
  Supersets alternés (repos après le dernier exo du tour), Remplacer (alternatives du programme,
  puis même muscle), exo hors programme, séance libre. Terminer demande un second tap ; une
  séance interrompue reprend au lancement. La barre de navigation est masquée pendant une séance.
  Salles (`src/donnees/salles.ts`, `salles.json`) : choisies sur l'accueil (reprise de la dernière
  séance), ajoutées et renommées dans Réglages. Sous le nom d'un exo à disques (Smith, presse, hack
  squat) ou à la poulie, une ligne repliée règle la machine dans la salle du jour : poids à vide, ou
  poulie à moufle. Le journal note ce qui se lit (disques seuls, chiffre de la pile) ; les calculs
  prennent la charge réelle, avec les réglages lus au moment du calcul (le passé suit une correction).
  Champs charge / reps : le toucher sélectionne la valeur, la frappe la remplace. Exo fini : message
  tiré des données (`encouragement`), exo suivant marqué « en option » s'il l'est.
  Accueil : carte « Échauffement » dépliée (`preparation` : la mobilité des muscles principaux du
  jour, sans cardio), puis la barre à vide ×15 et les séries d'approche à la saisie du premier exo.
  Avertissement en rouge si une règle `ecart` est touchée (« Hack squat il y a 30 h »),
  sans rien bloquer. Semaine de test : après les séries prévues du principal, tentatives de 1RM
  (bench) ou 3RM, ouverture à 95 % du max estimé puis recalage à 0 RIR, fini à 0 RIR ou sous les
  reps ; « Passer le test » reste possible. Bloc fini (dernière semaine bouclée) : l'accueil
  propose « Nouveau bloc » avec les 1RM du test (sinon le meilleur estimé). Terminer affiche le
  résumé : durée, séries, tonnage, records de 1RM estimé, stats du personnage qui ont bougé.
- `src/donnees/stats.ts` : stats du personnage (formules dans `docs/stats.md`), fonctions pures
  du journal et des pesées ; références de Force selon le sexe choisi dans les réglages
  (`sexe` de `reglages.json`, absent = homme). `src/ecrans/Personnage.tsx` : onglet « Perso », Force, Endurance,
  Constance, Progression et groupes en barres de 10 cases, écart de 1RM estimé par exo sur 4 semaines.
- `src/donnees/avatar.ts` : personnage en pixel art (24 × 27), grille calculée depuis les paliers
  de Force, Endurance et Constance (seuils dans `docs/stats.md`, « Personnage »), dessiné en SVG
  dans l'onglet Perso à côté de celui d'il y a 8 semaines ; variante femme (cheveux longs,
  brassière, hanches), mêmes paliers.
- `src/minuteur.ts` : repos = notification programmée en alarme exacte (permissions
  `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` dans
  `src-tauri/gen/android/app/src/main/AndroidManifest.xml`), jamais un compteur JS. Pendant le
  repos, décompte muet dans le volet et sur l'écran verrouillé (`ReposPlugin.kt`, chronomètre
  système, effacé à la fin ; commandes `repos_afficher` / `repos_retirer` dans `src-tauri/src/repos.rs`).
- `src/i18n/` : langues de l'interface, français (`fr.ts`, la référence et le type `Textes`),
  anglais (`en.ts`), portugais du Brésil (`pt.ts`), sans bibliothèque. `t` est lu au rendu ;
  `src/langue.ts` (`appliquerLangue`) le pose et traduit aussi les noms d'exos (`t.exos`, posés
  sur le catalogue) et les textes des programmes du code (`t.programmesTextes`, texte français →
  traduction). Langue choisie à la bienvenue et dans Réglages (`langue` de `reglages.json`,
  absent = langue du téléphone). Les fichiers ne gardent que des identifiants : changer de langue
  ne réécrit rien ; les programmes écrits dans l'app restent dans la langue de leur auteur.
  Textes natifs (notification de repos, canaux, partage) : `res/values*/textes.xml` dans
  `gen/android`, selon la langue du téléphone. Ajouter un texte : la clé dans `fr.ts`, le
  compilateur réclame les deux autres ; un texte de programme ou un exo sans traduction fait
  échouer `src/i18n/i18n.test.ts`.
- `src/theme.css` : toutes les couleurs, un bloc par thème (règle 60/30/10) ; liste des thèmes
  dans `src/themes.ts`. Couleurs des disques fixes.
- `src/styles.css` : style « Fiche de perso » (Chakra Petch, libellés en capitales espacées, angles
  carrés, bordures épaisses, bouton principal en relief). Thème par défaut : Braise.
- `src/polices/` : Chakra Petch embarquée (woff2, sous-ensemble latin, licence OFL) :
  aucune police chargée depuis Internet, l'app reste complète en mode avion.
- Icône : le personnage de l'onglet Perso (thème Braise), dessiné par `scripts/icone.ts` depuis
  `avatar.ts`. `npm run icone` écrit les sources dans `icone/` puis `tauri icon` régénère
  `src-tauri/icons/` et les mipmaps Android (`gen/android`, icône adaptative : premier plan
  réduit au disque visible, fond `#15110f`). Les PNG ne se retouchent pas à la main.

## Dev et prod

Deux apps distinctes, compilées depuis le même code. La variable `EXZIFIT_CANAL` (`dev` par
défaut, `prod`) est lue à trois endroits : `src-tauri/build.rs` (cfg Rust `canal_dev`),
`gen/android/app/build.gradle.kts` (identifiant, nom, manifeste) et `vite.config.ts` (`src/canal.ts`).

| | dev | prod |
|---|---|---|
| Identifiant, nom | `com.exzitech.exzifit.dev`, « ExziFit Dev » | `com.exzitech.exzifit`, « ExziFit » |
| Données | les siennes : essayer en dev ne touche jamais l'historique réel | l'historique réel |
| Mise à jour | Nextcloud (`npm run publier`, ci-dessous) | Google Play seulement (`npm run publier-play`) |
| Envoi des sauvegardes, synchro | oui | non (pas de lien de dépôt dans l'app publique) |
| Branche | `dev` (ou toute branche de travail) | `main`, tag `vX.Y.Z` par version publiée |

Pourquoi le code Nextcloud sort de la prod : Google Play interdit à une app de se mettre à jour
hors du Play Store (`REQUEST_INSTALL_PACKAGES` refusée pour cet usage), et le lien de dépôt
intégré à l'APK serait lisible par n'importe qui. `maj.rs`, `envoi.rs`, `synchro.rs`,
`InstallateurPlugin.kt` (`src/canal-dev/`) et la permission (`src/canal-dev/AndroidManifest.xml`)
ne sont compilés qu'en dev. Le minuteur demande l'alarme exacte par `SCHEDULE_EXACT_ALARM` dans
les deux canaux (bandeau `AlarmeExacte.tsx` tant qu'Android 14+ ne l'a pas permise), pour que la
dev teste ce que la prod fait.

**Flux** : travailler sur `dev`, `npm run publier` pour l'essayer à la salle sur ExziFit Dev ;
quand c'est validé, fusionner dans `main`, `npm run publier-play`, déposer l'AAB sur la Play
Console en **test interne**, l'installer depuis le Play Store, puis promouvoir en production.
`publier-play` refuse : une autre branche que `main`, un fichier modifié ou non suivi, une
version pas plus récente que le dernier tag ; il lance `npm test` et `cargo test`, vérifie le
manifeste final (identifiant prod, aucune permission refusée par Play) et copie l'AAB dans
`livraisons/` (hors dépôt). Bascule et démarches côté Google : [docs/play-store.md](docs/play-store.md).

## Mise à jour en ligne (dev)

Dossier `C:\Users\tomro\Nextcloud\ExziFit` (chemin dans `publier.local.json`, local),
partagé par **lien public** Nextcloud ; le lien est dans `src-tauri/maj.json`, intégré à la
compilation (fichier local, hors dépôt : copier `maj.exemple.json` et y mettre le lien).
Il contient `ExziFit-dev.apk` (première installation à la main, depuis l'app Nextcloud)
et `version-dev.json` (version, empreinte SHA-256, taille). `ExziFit.apk` et `version.json`
restent figés en 0.1.43 : les installations d'avant la séparation (identifiant prod) n'y
trouveront plus rien et passeront par le Play Store.

`npm run publier` passe au correctif suivant si la version est déjà publiée
(`tauri.conf.json`, `Cargo.toml`, `package.json`), compile en release (Rust optimisé pour la
taille, code natif compressé), dépose l'APK puis `version-dev.json`. Au lancement, l'app compare
sa version (`src-tauri/src/maj.rs`) et affiche un bandeau **Installer** : téléchargement,
vérification de l'empreinte, installeur d'Android (`gen/android/.../InstallateurPlugin.kt`).
Sans réseau, rien ne s'affiche. La première fois, Android demande d'autoriser ExziFit à
installer des applications.

Signature (les deux canaux) : `src-tauri/gen/android/keystore.properties` (local) pointe vers
`C:\Users\tomro\.android\exzifit-release.jks`, aussi clé de signature de la prod sur Google Play. **Garder la clé et son mot de passe en lieu
sûr** : un APK signé par une autre clé (dont la clé de debug) ne peut pas mettre à jour l'app
installée, il faut la désinstaller avec ses données.

## Travailler sur un autre poste

Le code, la doc et les notes de Claude sont dans le dépôt ; cinq fichiers locaux n'y sont
**pas** (secrets ou liens de partage, dépôt public) et se copient à la main, par clé USB ou
dossier privé, jamais par git. Copie à jour dans le dossier Nextcloud **non partagé**
`ExziFit-prive` (avec un `LISEZMOI.txt` qui dit où remettre chaque fichier) :

| Fichier | Sert à |
|---|---|
| `C:\Users\tomro\.android\exzifit-release.jks` | clé de signature : sans elle, plus de mise à jour de l'app installée |
| `src-tauri/gen/android/keystore.properties` | mot de passe et chemin de la clé |
| `src-tauri/maj.json` | lien public du dossier `ExziFit` (mise à jour en ligne ; modèle : `maj.exemple.json`) |
| `src-tauri/sauvegarde.json` | lien de dépôt `ExziFit-backups` (modèle : `sauvegarde.exemple.json`) |
| `publier.local.json` | chemin du dossier Nextcloud local où `npm run publier` dépose l'APK |

Puis : `git pull`, `npm ci`, recopier `docs/memoire/*.md` (sauf `README.md`) dans le dossier
de mémoire de Claude (voir [docs/memoire/README.md](docs/memoire/README.md)), et lancer
`npm test` et `npm run build`. Le client Nextcloud doit synchroniser le dossier `ExziFit`
pour que `npm run publier` dépose l'APK. Chaîne Android (SDK, NDK, Rust) : la même que pour ExziHub.

## Données

Dossier de données de l'app (`app_data_dir`, affiché dans Réglages). Voir
[docs/modele-donnees.md](docs/modele-donnees.md). Ne jamais tester sur le fichier vivant.

### Sauvegarde Android (réinstallation)

Comme une app du Play Store : la sauvegarde Android (Google) copie `donnees/` dans le compte Google
du téléphone et la **restaure d'elle-même à la réinstallation**, avant le premier lancement (pas
d'écran de bienvenue). Elle sert aussi au transfert vers un nouveau téléphone. Règles :
`gen/android/app/src/main/res/xml/sauvegarde_android12.xml` (Android 12 et plus) et
`sauvegarde_android11.xml`, déclarées dans le manifeste ; seul `donnees/` y entre (le dossier de la
WebView ferait dépasser le plafond de 25 Mo, au-delà duquel toute la sauvegarde échoue).
Android choisit le moment (environ une fois par 24 h, téléphone en charge, au repos, en Wi-Fi) et
il faut « Sauvegarde Google » active dans les réglages du téléphone. Forcer une copie, téléphone
branché : `adb shell bmgr backupnow com.exzitech.exzifit`. Restauration seulement si la même
signature d'APK est réinstallée. Rien de cela n'est vérifiable dans le navigateur.

### Export manuel

Réglages → « Exporter les données » : toutes les données actuelles en un fichier
`exzifit-AAAA-MM-JJ.json` (même format que les envois Nextcloud ci-dessous), écrit dans le cache
de l'app puis proposé au **partage Android** (`src-tauri/src/partage.rs`, `PartagePlugin.kt`, via
le FileProvider de l'installeur). Sur le PC, le fichier reste dans le cache (chemin affiché) ; dans
le navigateur (`npm run dev`), il est téléchargé.

### Restaurer un export

« Restaurer un export » sur l'écran de bienvenue (nouveau téléphone) et dans Réglages : sélecteur de
fichiers Android (`<input type="file">`, géré par la WebView de Tauri), résumé (jour, prénom, nombre
de séances, `resumerExport`), confirmation. La commande `importer` (`fichiers.rs`) contrôle tout le
paquet avant d'écrire (format 1, chemins validés, chaque `.json` lisible), copie les données
actuelles dans `sauvegardes/avant-import-AAAA-MM-JJ-HHMMSS/` (ni élaguée ni envoyée), puis
**remplace** : un fichier absent de l'export, comme une séance en cours, disparaît. L'app se recharge
ensuite. Revenir en arrière = recopier à la main le contenu de cette copie dans le dossier de données.
### Synchro PC ↔ téléphone

**Canal dev seulement** (voir « Dev et prod »).

Les deux appareils partagent `etat.json` dans le dossier Nextcloud privé `ExziFit-sync`
(format et règles de fusion : modèle de données, « Synchro »). Transport : `src-tauri/src/synchro.rs`
(WebDAV authentifié) ; fusion : `src/donnees/synchro.ts`. Synchro au lancement, au retour dans
l'app (1 par minute au plus) et 5 s après une écriture de séance, bloc ou pesée ; hors réseau, rien.

Mise en place (faite le 2026-10-14, VM `services`, Nextcloud en Docker) :
1. `occ user:add --password-from-env --display-name 'ExziFit synchro' exzifit`, quota 200 Mo
   (`occ user:setting exzifit files quota '200 MB'`). Mot de passe de connexion aléatoire, jamais noté.
2. Dossier `ExziFit-sync` dans **ses propres fichiers** (`data/exzifit/files/ExziFit-sync`, puis
   `occ files:scan --path=exzifit/files`) : aucun partage, le compte de Tom n'est pas touché.
3. Mot de passe d'application : `occ user:auth-tokens:add --password-from-env --name ExziFit exzifit`.
   Révocation : `occ user:auth-tokens:list exzifit` puis `user:auth-tokens:delete`.
4. Dans ExziFit, sur le téléphone **et** sur le PC : Réglages › Synchro, utilisateur `exzifit` et ce
   mot de passe d'application (serveur prérempli).

Le mot de passe est gardé dans `acces-synchro.json`, à la racine de `app_data_dir()`, **hors** de
`donnees/` : il ne part ni dans les sauvegardes ni dans le dépôt. Le compte `exzifit` n'a que
`ExziFit-sync` : un téléphone perdu n'expose rien d'autre ; révoquer le mot de passe d'application
dans Nextcloud suffit.

### Sauvegarde sur Nextcloud

**Canal dev seulement** (voir « Dev et prod ») : la version Google Play n'envoie rien.

**Installation de Tom seulement** : `reglages.json` sans `envoi` (installation antérieure à l'écran
de bienvenue). Une installation neuve (les potes) écrit `envoi: false` : le lien de dépôt est
celui de Tom, leurs copies y arriveraient. Le filtre est côté app (`App.tsx`), pas dans la commande
Rust.

Après la copie locale du jour, l'app envoie en arrière-plan la copie la plus récente
(`src-tauri/src/envoi.rs`) dans le dossier Nextcloud `ExziFit-backups`, partagé par lien ;
le lien est dans `src-tauri/sauvegarde.json`, intégré à la compilation (fichier local, hors
dépôt ; modèle dans `sauvegarde.exemple.json`). Ce dossier est distinct de `ExziFit`, dont le
lien public permet de tout lire.

Le partage est en **dépôt seul** (« File request », droit 4 dans `oc_share`) : le lien,
extractible de l'APK, permet d'envoyer un fichier, jamais de lire, d'écraser ni d'effacer.
L'app n'en demande pas plus : chaque envoi crée un nouveau fichier (un nom déjà pris
serait renommé « (2) » par Nextcloud, jamais écrasé).

- Un fichier `exzifit-AAAA-MM-JJ-EMPREINTE.json` (8 premiers caractères du SHA-256 du
  contenu) : `{ format, jour, fichiers }`, `fichiers` associant chaque chemin relatif à son texte
  exact. Plusieurs envois le même jour donnent plusieurs fichiers ; restaurer = prendre le plus
  récent (date du fichier dans Nextcloud) et réécrire chaque entrée à son chemin.
- Un build de dev (`npm run tauri dev`, APK debug) ajoute `-dev` au nom, pour distinguer ses
  copies de celles du téléphone.
- Envoyé seulement si le contenu a changé depuis le dernier envoi (`sauvegardes/envoyee.json`
  garde jour et empreinte) : un jour sans séance n'envoie rien.
- Hors réseau, rien ne s'affiche ; nouvel essai au lancement suivant. Une autre erreur
  (refus du serveur) s'affiche dans le bandeau d'erreurs.
- Pas d'élagage côté serveur (l'app n'efface jamais à distance). Réglages affiche le jour de
  la dernière copie envoyée.
