// Publie un APK sur Nextcloud : npm run publier (dev), npm run publier-potes (app des potes).
// La version Google Play passe par npm run publier-play.
//
// Dev : APK release signé du canal dev (« ExziFit Dev », com.exzitech.exzifit.dev), déposé en
// ExziFit-dev.apk dans le dossier partagé (synchronisé par le client Nextcloud, chemin dans
// publier.local.json) avec version-dev.json : l'app dev installée propose la mise à jour au
// lancement (src-tauri/src/maj.rs). Si la version courante n'est pas plus récente que celle
// publiée, elle passe au correctif suivant dans tauri.conf.json, Cargo.toml et package.json.
// Potes (--potes) : canal potes (« ExziFit », com.exzitech.exzifit, sans envoi ni synchro), déposé
// en ExziFit.apk avec version.json. Seulement ce qui a été validé en dev : branche main, rien de
// modifié, version plus récente que celle publiée (jamais montée automatiquement).
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { nombres, plusRecente } = require("./versions.cjs");

const racine = path.resolve(__dirname, "..");
const potes = process.argv.includes("--potes");
const canal = potes ? "potes" : "dev";
const nomApk = potes ? "ExziFit.apk" : "ExziFit-dev.apk";
const nomVersion = potes ? "version.json" : "version-dev.json";
const lire = (f) => fs.readFileSync(path.join(racine, f), "utf8");
const ecrire = (f, texte) => fs.writeFileSync(path.join(racine, f), texte);

const local = path.join(racine, "publier.local.json");
if (!fs.existsSync(local)) throw new Error(`${local} absent : { "dossier": "C:\\\\...\\\\Nextcloud\\\\ExziFit" }`);
const dossier = JSON.parse(fs.readFileSync(local, "utf8")).dossier;
if (!fs.existsSync(dossier)) throw new Error(`Dossier de publication introuvable : ${dossier}`);
if (!JSON.parse(lire("src-tauri/maj.json")).lien) throw new Error("src-tauri/maj.json : lien de partage vide, l'app ne trouverait pas ses mises à jour.");
if (!fs.existsSync(path.join(racine, "src-tauri/gen/android/keystore.properties"))) {
  throw new Error("src-tauri/gen/android/keystore.properties absent : l'APK sortirait non signé.");
}

if (potes) {
  const sortie = (cmd) => execSync(cmd, { cwd: racine, encoding: "utf8" }).trim();
  const branche = sortie("git rev-parse --abbrev-ref HEAD");
  if (branche !== "main") throw new Error(`Branche ${branche} : l'app des potes se compile depuis main seulement.`);
  const modifie = sortie("git status --porcelain");
  if (modifie) throw new Error(`Fichiers modifiés ou non suivis : committer ou mettre de côté d'abord.\n${modifie}`);
}

// Parcours complets dans l'interface web (README, « Scénarios dirigés ») : un échec arrête tout.
execSync("npm run scenarios", { cwd: racine, stdio: "inherit" });

let version = JSON.parse(lire("src-tauri/tauri.conf.json")).version;
const cargo = lire("src-tauri/Cargo.toml").match(/^version = "(.+)"/m)?.[1];
if (cargo !== version) throw new Error(`Versions différentes : tauri.conf.json ${version}, Cargo.toml ${cargo}.`);

const fichierVersion = path.join(dossier, nomVersion);
const publiee = fs.existsSync(fichierVersion) ? JSON.parse(fs.readFileSync(fichierVersion, "utf8")).version : null;
if (potes && publiee && !plusRecente(version, publiee)) {
  throw new Error(`Version ${version} pas plus récente que celle des potes (${publiee}) : monter la version sur dev, fusionner, recommencer.`);
}
if (publiee && !plusRecente(version, publiee)) {
  const [maj, min, cor] = nombres(publiee);
  const suivante = `${maj}.${min}.${cor + 1}`;
  ecrire("src-tauri/tauri.conf.json", lire("src-tauri/tauri.conf.json").replace(`"version": "${version}"`, `"version": "${suivante}"`));
  ecrire("src-tauri/Cargo.toml", lire("src-tauri/Cargo.toml").replace(/^version = ".+"/m, `version = "${suivante}"`));
  ecrire("package.json", lire("package.json").replace(`"version": "${version}"`, `"version": "${suivante}"`));
  console.log(`Version ${version} déjà publiée ou dépassée (${publiee}) : passage en ${suivante}`);
  version = suivante;
}

// Rust optimisé pour la taille : APK bien plus léger à télécharger par l'envoi lent de la
// maison, sans effet sensible ici (pas de calcul lourd).
const env = { ...process.env, EXZIFIT_CANAL: canal, CARGO_PROFILE_RELEASE_OPT_LEVEL: "z", CARGO_PROFILE_RELEASE_CODEGEN_UNITS: "1" };
execSync("npx tauri android build --apk --target aarch64", { cwd: racine, stdio: "inherit", env });
const apk = path.join(racine, "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk");
const octets = fs.readFileSync(apk);

// L'APK d'abord, le fichier de version ensuite : une app qui lit la nouvelle version trouve le bon
// fichier (sauf synchro Nextcloud en cours, que l'empreinte détecte). Renommage atomique.
const deposer = (nom, contenu) => {
  const f = path.join(dossier, nom);
  fs.writeFileSync(f + ".tmp", contenu);
  fs.renameSync(f + ".tmp", f);
};
deposer(nomApk, octets);
const sha256 = crypto.createHash("sha256").update(octets).digest("hex");
deposer(nomVersion, JSON.stringify({ version, fichier: nomApk, sha256, taille: octets.length }, null, 2) + "\n");
console.log(`${potes ? "ExziFit (potes)" : "ExziFit Dev"} ${version} publié dans ${dossier} (${(octets.length / 1024 / 1024).toFixed(1)} Mo)`);
