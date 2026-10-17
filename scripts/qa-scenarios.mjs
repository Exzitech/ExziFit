// Scénarios dirigés, sans IA : des parcours complets rejoués à l'identique avant chaque publication
// (`npm run publier` les lance et s'arrête au premier échec). Même banc que l'agent de QA
// (scripts/qa-ia.mjs) : `npm run dev`, Chromium 390 × 844, localStorage neuf rempli par le jeu
// « exemple ». README, « Scénarios dirigés ».
//
// node scripts/qa-scenarios.mjs [--visible] [nom du scénario…]

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { controlerFichier } from "../src/donnees/controle.ts";
import { arreterDev, donneesExemple, isoLocal, lancerDev } from "./qa-ia.mjs";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const URL_APP = "http://localhost:1420";
const MAX_ACTIONS = 300; // une séance du Bloc Force en demande une soixantaine
const RIR = 2; // réserve notée à chaque série : ni palier de montée (4+), ni échec

// ---------- Lecture de l'état ----------

const fichiers = (page) => page.evaluate(() =>
  Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("exzifit/")).map((k) => [k.slice(8), localStorage.getItem(k)])));

const seances = (f) => Object.entries(f).filter(([k]) => /^journal\/\d{4}-\d{2}\.json$/.test(k))
  .flatMap(([, v]) => JSON.parse(v).seances).sort((a, b) => a.debut.localeCompare(b.debut));

const enCours = (f) => (f["en-cours.json"] ? JSON.parse(f["en-cours.json"]).seance : null);

const nbSeries = (s) => s.exercices.reduce((n, x) => n + x.series.length, 0);

async function stabiliser(page) {
  let avant = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    const ici = await page.evaluate(() => document.body.innerHTML.length + ":" + document.body.innerText);
    if (ici === avant) return;
    avant = ici;
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ---------- Session ----------

/** Navigateur neuf sur le jeu « exemple », erreurs JS collectées dans `s.erreurs`. */
async function ouvrir(navigateur) {
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
  const page = await contexte.newPage();
  const s = { contexte, page, erreurs: [], actions: [], validations: 0 };
  page.on("pageerror", (e) => s.erreurs.push(`pageerror : ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) s.erreurs.push(`console.error : ${m.text().split("\n")[0]}`);
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.goto(URL_APP);
  await page.evaluate((f) => { localStorage.clear(); for (const [k, v] of Object.entries(f)) localStorage.setItem("exzifit/" + k, v); }, donneesExemple());
  await page.reload();
  await stabiliser(page);
  s.avant = seances(await fichiers(page)).length;
  return s;
}

/** Ce qui ne doit jamais arriver, quel que soit le scénario. Lève à la première faute. */
async function controler(s, etape) {
  const f = await fichiers(s.page);
  const fautes = [
    ...s.erreurs,
    ...Object.entries(f).flatMap(([chemin, texte]) => controlerFichier(chemin, texte).map((m) => `donnée impossible : ${m}`)),
    ...(await s.page.locator(".erreurs .erreur, .erreurs .avertissement").allInnerTexts()).map((m) => `affiché : ${m.replace(/\s+/g, " ")}`),
    ...[...new Set((await s.page.locator("body").innerText()).match(/\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/g) ?? [])]
      .map((m) => `« ${m} » affiché`),
  ];
  if (fautes.length) throw new Error(`${etape} :\n  ${fautes.join("\n  ")}`);
  return f;
}

async function toucher(s, locator, quoi) {
  const texte = (await locator.innerText()).replace(/\s+/g, " ").trim();
  s.actions.push(`${quoi} « ${texte} »`);
  await locator.click({ timeout: 3000 });
  await stabiliser(s.page);
  await controler(s, `après ${quoi} « ${texte} »`);
  return texte;
}

/** Une action de saisie : le RIR s'il est demandé, sinon le bouton principal tel que prérempli. */
async function unPas(s) {
  const rir = s.page.locator(".rir button");
  if (await rir.count()) return toucher(s, rir.nth(RIR), "RIR");
  const principal = s.page.locator("button.principal.valider");
  if (!(await principal.count())) throw new Error("ni RIR ni bouton principal à l'écran");
  // Rien n'est jamais tapé ici : un « Sûr ? » douterait de la proposition de l'app elle-même.
  const texte = await principal.innerText();
  if (/^(Sûr|Sure|Certeza) ?\?/.test(texte.trim())) throw new Error(`confirmation demandée sur la valeur préremplie : « ${texte} »`);
  if (/×/.test(texte)) s.validations++;
  return toucher(s, principal, "Valider");
}

async function demarrer(s) {
  await toucher(s, s.page.locator(".bas button.principal.valider"), "Démarrer");
  if (!enCours(await fichiers(s.page))) throw new Error("Démarrer n'a pas écrit en-cours.json");
}

/** Saisit tout tel que prérempli jusqu'à la séance archivée, puis vérifie le journal. */
async function finir(s) {
  for (let i = 0; i < MAX_ACTIONS; i++) {
    await unPas(s);
    const f = await fichiers(s.page);
    const toutes = seances(f);
    if (toutes.length === s.avant) continue;
    if (toutes.length !== s.avant + 1) throw new Error(`${toutes.length - s.avant} séances archivées d'un coup`);
    if (enCours(f)) throw new Error("séance archivée mais toujours dans en-cours.json");
    const faite = toutes.at(-1);
    if (nbSeries(faite) !== s.validations)
      throw new Error(`${s.validations} séries validées, ${nbSeries(faite)} au journal`);
    if (!(await s.page.locator("button.principal.valider", { hasText: /^OK$/ }).count())) throw new Error("pas de résumé de fin de séance");
    return faite;
  }
  throw new Error(`séance toujours pas finie après ${MAX_ACTIONS} actions`);
}

// ---------- Scénarios ----------

const SCENARIOS = {
  /** Le jour suivant du Bloc Force, de Démarrer au résumé, tout validé tel que prérempli. */
  async "seance-complete"(s) {
    await demarrer(s);
    const faite = await finir(s);
    if (faite.programme !== "bloc-force" || !faite.jour) throw new Error(`séance archivée hors programme : ${faite.programme}/${faite.jour}`);
  },

  /** Machine prise après une série : remplaçant proposé en premier, puis fin de séance. */
  async remplacement(s) {
    await demarrer(s);
    await unPas(s); // série
    await unPas(s); // RIR
    await toucher(s, s.page.locator(".haut button.lien").nth(1), "Remplacer");
    await toucher(s, s.page.locator(".liste button.ligne").first(), "Remplaçant");
    const remplacant = enCours(await fichiers(s.page)).exercices.find((x) => x.remplace);
    if (!remplacant) throw new Error("aucun exo marqué `remplace` dans en-cours.json");
    const faite = await finir(s);
    const garde = faite.exercices.find((x) => x.exo === remplacant.exo && x.remplace === remplacant.remplace);
    if (!garde?.series.length) throw new Error(`remplaçant ${remplacant.exo} absent ou vide au journal`);
  },

  /** Langue changée puis app relancée en pleine séance : la séance reprend, dans la nouvelle langue. */
  async "langue-relance"(s) {
    await demarrer(s);
    await unPas(s);
    await unPas(s);
    const avant = enCours(await fichiers(s.page));
    await s.page.evaluate(() => {
      const r = JSON.parse(localStorage.getItem("exzifit/reglages.json"));
      localStorage.setItem("exzifit/reglages.json", JSON.stringify({ ...r, langue: "en" }));
    });
    s.actions.push("langue → en, relance");
    await s.page.reload();
    await stabiliser(s.page);
    const apres = enCours(await controler(s, "après la relance"));
    if (JSON.stringify(apres) !== JSON.stringify(avant)) throw new Error("séance en cours modifiée par la relance");
    const principal = await s.page.locator("button.principal.valider").innerText().catch(() => "");
    if (!/^Log /.test(principal.trim())) throw new Error(`saisie pas reprise en anglais : bouton principal « ${principal} »`);
    await finir(s);
  },
};

// ---------- Lancement ----------

async function main() {
  const args = process.argv.slice(2);
  const visible = args.includes("--visible");
  const noms = args.filter((a) => a !== "--visible");
  for (const n of noms) if (!(n in SCENARIOS)) throw new Error(`scénario inconnu : ${n} (${Object.keys(SCENARIOS).join(", ")})`);
  const choisis = noms.length ? noms : Object.keys(SCENARIOS);

  const serveur = await lancerDev();
  const navigateur = await chromium.launch({ headless: !visible });
  const echecs = [];
  try {
    for (const nom of choisis) {
      const t0 = Date.now();
      const s = await ouvrir(navigateur);
      try {
        await SCENARIOS[nom](s);
        console.log(`ok     ${nom} (${s.actions.length} actions, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      } catch (e) {
        const dossier = join(RACINE, "qa-rapports", `scenarios-${isoLocal(new Date()).slice(0, 19).replace(/[:T]/g, "-")}`);
        mkdirSync(dossier, { recursive: true });
        const capture = join(dossier, `${nom}.png`);
        await s.page.screenshot({ path: capture }).catch(() => {});
        echecs.push(nom);
        console.log(`ÉCHEC  ${nom} : ${e.message}\n  dernières actions : ${s.actions.slice(-6).join(" → ")}\n  capture : ${capture}`);
      } finally {
        await s.contexte.close();
      }
    }
  } finally {
    await navigateur.close();
    arreterDev(serveur);
  }
  if (echecs.length) throw new Error(`${echecs.length} scénario(s) en échec : ${echecs.join(", ")}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
