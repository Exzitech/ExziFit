// Prépare une version **prod** pour Google Play : npm run publier-play
//
// Refuse de compiler si la prod ne correspond pas exactement à un état connu du dépôt : branche
// main, rien de modifié, version plus récente que la dernière publiée (tag vX.Y.Z). Lance les
// tests, compile l'AAB signé du canal prod (com.exzitech.exzifit, sans mise à jour Nextcloud),
// vérifie le manifeste final, copie l'AAB dans livraisons/ et pose le tag de la version.
// L'envoi sur la Play Console reste manuel (docs/play-store.md) : piste de test interne d'abord.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { plusRecente } = require("./versions.cjs");

const racine = path.resolve(__dirname, "..");
const sortie = (cmd) => execSync(cmd, { cwd: racine, encoding: "utf8" }).trim();
const lancer = (cmd, env = process.env) => execSync(cmd, { cwd: racine, stdio: "inherit", env });
const android = path.join(racine, "src-tauri/gen/android");

if (!fs.existsSync(path.join(android, "keystore.properties"))) {
  throw new Error("src-tauri/gen/android/keystore.properties absent : l'AAB sortirait non signé.");
}
const branche = sortie("git rev-parse --abbrev-ref HEAD");
if (branche !== "main") throw new Error(`Branche ${branche} : la prod se compile depuis main seulement.`);
const modifie = sortie("git status --porcelain");
if (modifie) throw new Error(`Fichiers modifiés ou non suivis : committer ou mettre de côté d'abord.\n${modifie}`);

const version = JSON.parse(fs.readFileSync(path.join(racine, "src-tauri/tauri.conf.json"), "utf8")).version;
const cargo = fs.readFileSync(path.join(racine, "src-tauri/Cargo.toml"), "utf8").match(/^version = "(.+)"/m)?.[1];
if (cargo !== version) throw new Error(`Versions différentes : tauri.conf.json ${version}, Cargo.toml ${cargo}.`);
const tags = sortie('git tag -l "v*"').split("\n").filter(Boolean).map((t) => t.slice(1));
const derniere = tags.reduce((a, b) => (a === null || plusRecente(b, a) ? b : a), null);
if (derniere && !plusRecente(version, derniere)) {
  throw new Error(`Version ${version} pas plus récente que la dernière publiée (v${derniere}) : monter la version sur dev, fusionner, recommencer.`);
}

lancer("npm test");
lancer("cargo test --manifest-path src-tauri/Cargo.toml");

// Même optimisation que publier.cjs ; arm64 + armv7 : Google Play ne livre à chaque téléphone que
// le code de son processeur, l'AAB peut donc tout contenir sans alourdir le téléchargement.
const env = { ...process.env, EXZIFIT_CANAL: "prod", CARGO_PROFILE_RELEASE_OPT_LEVEL: "z", CARGO_PROFILE_RELEASE_CODEGEN_UNITS: "1" };
lancer("npx tauri android build --aab --target aarch64 --target armv7", env);

// Garde-fou : le manifeste final ne doit rien contenir que Google Play refuse.
const manifestes = [];
const chercher = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) chercher(p);
    else if (e.name === "AndroidManifest.xml") manifestes.push(p);
  }
};
const intermediaires = path.join(android, "app/build/intermediates/merged_manifests/universalRelease");
if (!fs.existsSync(intermediaires)) throw new Error(`Manifeste final introuvable : ${intermediaires}`);
chercher(intermediaires);
if (!manifestes.length) throw new Error(`Aucun AndroidManifest.xml dans ${intermediaires}`);
for (const m of manifestes) {
  const texte = fs.readFileSync(m, "utf8");
  if (!texte.includes('package="com.exzitech.exzifit"')) throw new Error(`Identifiant prod absent du manifeste (${m}).`);
  const interdits = ["android.permission.REQUEST_INSTALL_PACKAGES", "android.permission.USE_EXACT_ALARM", "android.intent.category.LEANBACK_LAUNCHER"];
  for (const nom of interdits) {
    if (texte.includes(`android:name="${nom}"`)) throw new Error(`${nom} dans le manifeste prod (${m}) : AAB refusé.`);
  }
}

const aab = path.join(android, "app/build/outputs/bundle/universalRelease/app-universal-release.aab");
const livraisons = path.join(racine, "livraisons");
fs.mkdirSync(livraisons, { recursive: true });
const copie = path.join(livraisons, `ExziFit-${version}.aab`);
fs.copyFileSync(aab, copie);
lancer(`git tag -a v${version} -m "ExziFit ${version} (Google Play)"`);
console.log(`\nExziFit ${version} prêt : ${copie} (${(fs.statSync(copie).size / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`Tag v${version} posé (local). À envoyer : git push origin v${version}`);
console.log("Ensuite : Play Console > Tests > Test interne > Créer une version, déposer l'AAB.");
