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
| `npm run publier` | APK release signé, déposé sur Nextcloud ; le téléphone le propose au lancement |
| `npx tauri android build --debug --target aarch64 --apk` | APK de debug (clé de debug : ne met pas à jour l'app installée) |

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
  le calcul de la charge préremplie.
- `src/donnees/programme.ts` : programme en cours (le Bloc Force, transcrit dans
  `src/donnees/programmes/bloc-force.json`, dans le code tant qu'il n'y a pas d'éditeur), jour
  et semaine proposés (rotation, jour optionnel sauté après 5 jours lourds d'affilée), charge
  prescrite (% du 1RM du bloc relevé par la dernière séance, double progression, RPE), recalage
  série par série par le RIR (`recalage`), échauffement et disques par côté, avertissements des
  règles `ecart`, semaine de test (`etatTest`, `resultatTest`), fin de bloc (`blocFini`,
  `rmNouveauBloc`) et résumé de fin de séance (`bilan`).
  `bloc.ts` : `blocs.json` (1RM figés du bloc) et `poids.json` (poids de corps, pour les lestés).
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
  Accueil : avertissement en rouge si une règle `ecart` est touchée (« Hack squat il y a 30 h »),
  sans rien bloquer. Semaine de test : après les séries prévues du principal, tentatives de 1RM
  (bench) ou 3RM, ouverture à 95 % du max estimé puis recalage à 0 RIR, fini à 0 RIR ou sous les
  reps ; « Passer le test » reste possible. Bloc fini (dernière semaine bouclée) : l'accueil
  propose « Nouveau bloc » avec les 1RM du test (sinon le meilleur estimé). Terminer affiche le
  résumé : durée, séries, tonnage, records de 1RM estimé.
- `src/minuteur.ts` : repos = notification programmée en alarme exacte (permissions
  `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` dans
  `src-tauri/gen/android/app/src/main/AndroidManifest.xml`), jamais un compteur JS.
- `src/theme.css` : toutes les couleurs, un bloc par thème (règle 60/30/10) ; liste des thèmes
  dans `src/themes.ts`. Couleurs des disques fixes.
- `src/styles.css` : style « Fiche de perso » (Chakra Petch, libellés en capitales espacées, angles
  carrés, bordures épaisses, bouton principal en relief). Thème par défaut : Braise.
- `src/polices/` : Chakra Petch embarquée (woff2, sous-ensemble latin, licence OFL) :
  aucune police chargée depuis Internet, l'app reste complète en mode avion.
- Icône : `icone/exzifit.svg`, régénérée par `npx tauri icon icone/exzifit.svg -o src-tauri/icons`.

## Mise à jour en ligne

Dossier `C:\Users\tomro\Nextcloud\ExziFit` (chemin dans `publier.local.json`, local),
partagé par **lien public** Nextcloud ; le lien est dans `src-tauri/maj.json`, intégré à la
compilation (fichier local, hors dépôt : copier `maj.exemple.json` et y mettre le lien).
Il contient `ExziFit.apk` (première installation à la main, depuis l'app Nextcloud)
et `version.json` (version, empreinte SHA-256, taille).

`npm run publier` passe au correctif suivant si la version est déjà publiée
(`tauri.conf.json`, `Cargo.toml`, `package.json`), compile en release (Rust optimisé pour la
taille, code natif compressé), dépose l'APK puis `version.json`. Au lancement, l'app compare
sa version (`src-tauri/src/maj.rs`) et affiche un bandeau **Installer** : téléchargement,
vérification de l'empreinte, installeur d'Android (`gen/android/.../InstallateurPlugin.kt`).
Sans réseau, rien ne s'affiche. La première fois, Android demande d'autoriser ExziFit à
installer des applications.

Signature : `src-tauri/gen/android/keystore.properties` (local) pointe vers
`C:\Users\tomro\.android\exzifit-release.jks`. **Garder la clé et son mot de passe en lieu
sûr** : un APK signé par une autre clé (dont la clé de debug) ne peut pas mettre à jour l'app
installée, il faut la désinstaller avec ses données.

## Données

Dossier de données de l'app (`app_data_dir`, affiché dans Réglages). Voir
[docs/modele-donnees.md](docs/modele-donnees.md). Ne jamais tester sur le fichier vivant.

### Sauvegarde sur Nextcloud

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
