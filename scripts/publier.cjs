// Publie l'APK **dev** sur Nextcloud : npm run publier (la prod passe par npm run publier-play).
//
// Compile l'APK release signé du canal dev (« ExziFit Dev », com.exzitech.exzifit.dev), le dépose
// en ExziFit-dev.apk dans le dossier partagé (synchronisé par le client Nextcloud, chemin dans
// publier.local.json) et écrit version-dev.json : l'app dev installée propose la mise à jour au
// lancement (src-tauri/src/maj.rs). ExziFit.apk et version.json restent figés en 0.1.43 pour les
// installations d'avant la séparation dev/prod, qui passent ensuite par le Play Store.
// Si la version courante n'est pas plus récente que celle publiée, elle passe au correctif
// suivant dans tauri.conf.json, Cargo.toml et package.json avant la compilation.
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { nombres, plusRecente } = require("./versions.cjs");

const racine = path.resolve(__dirname, "..");
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

// Parcours complets dans l'interface web (README, « Scénarios dirigés ») : un échec arrête tout.
execSync("npm run scenarios", { cwd: racine, stdio: "inherit" });

let version = JSON.parse(lire("src-tauri/tauri.conf.json")).version;
const cargo = lire("src-tauri/Cargo.toml").match(/^version = "(.+)"/m)?.[1];
if (cargo !== version) throw new Error(`Versions différentes : tauri.conf.json ${version}, Cargo.toml ${cargo}.`);

const fichierVersion = path.join(dossier, "version-dev.json");
const publiee = fs.existsSync(fichierVersion) ? JSON.parse(fs.readFileSync(fichierVersion, "utf8")).version : null;
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
const env = { ...process.env, EXZIFIT_CANAL: "dev", CARGO_PROFILE_RELEASE_OPT_LEVEL: "z", CARGO_PROFILE_RELEASE_CODEGEN_UNITS: "1" };
execSync("npx tauri android build --apk --target aarch64", { cwd: racine, stdio: "inherit", env });
const apk = path.join(racine, "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk");
const octets = fs.readFileSync(apk);

// L'APK d'abord, version-dev.json ensuite : une app qui lit la nouvelle version trouve le bon
// fichier (sauf synchro Nextcloud en cours, que l'empreinte détecte). Renommage atomique.
const deposer = (nom, contenu) => {
  const f = path.join(dossier, nom);
  fs.writeFileSync(f + ".tmp", contenu);
  fs.renameSync(f + ".tmp", f);
};
deposer("ExziFit-dev.apk", octets);
const sha256 = crypto.createHash("sha256").update(octets).digest("hex");
deposer("version-dev.json", JSON.stringify({ version, fichier: "ExziFit-dev.apk", sha256, taille: octets.length }, null, 2) + "\n");
console.log(`ExziFit Dev ${version} publié dans ${dossier} (${(octets.length / 1024 / 1024).toFixed(1)} Mo)`);
