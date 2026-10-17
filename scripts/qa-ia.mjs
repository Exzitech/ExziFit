// Agent de QA par IA locale : Playwright pilote `npm run dev` (http://localhost:1420, données en
// localStorage d'un navigateur neuf, jamais les vraies données), Qwen (Ollama) choisit les actions
// et regarde les captures. Rapport dans qa-rapports/<date-heure>/. README, « Agent de QA ».
//
// node scripts/qa-ia.mjs [--objectif "..."] [--etapes 150] [--donnees vide|exemple] [--graine N]
//                        [--vision 10] [--visible]

import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { controlerFichier } from "../src/donnees/controle.ts";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const URL_APP = "http://localhost:1420";
const OLLAMA = "http://localhost:11434";
const MODELE = "qwen2.5vl:7b";
const MAX_ELEMENTS = 35; // au-delà, le prompt grossit sans aider un 7B
const BLOCAGE_N = 4; // même état N fois de suite → action forcée
const ORNIERE = 15; // étapes de suite sur un même écran → une sur cinq forcée vers l'élément le moins touché
const OBJECTIF_DEFAUT =
  "Explorer un maximum d'écrans différents et essayer de casser les formulaires : champs vides, " +
  "valeurs négatives, très longues, caractères spéciaux.";

// ---------- Options ----------

function options(argv) {
  const o = { objectif: OBJECTIF_DEFAUT, etapes: 150, donnees: "exemple", graine: Date.now() % 1e9, vision: 10, visible: false };
  for (let i = 0; i < argv.length; i++) {
    const nom = argv[i].replace(/^--/, "");
    if (nom === "visible") { o.visible = true; continue; }
    if (!(nom in o)) throw new Error(`option inconnue : ${argv[i]}`);
    const v = argv[++i];
    if (v === undefined) throw new Error(`valeur manquante pour --${nom}`);
    o[nom] = typeof o[nom] === "number" ? Number(v) : v;
    if (typeof o[nom] === "number" && !Number.isFinite(o[nom])) throw new Error(`--${nom} : nombre attendu, reçu « ${v} »`);
  }
  if (!["vide", "exemple"].includes(o.donnees)) throw new Error(`--donnees : vide ou exemple, reçu « ${o.donnees} »`);
  return o;
}

// mulberry32 : même graine → mêmes tirages (le modèle reçoit aussi la graine, mais sa sortie
// peut varier d'une machine ou d'une version d'Ollama à l'autre).
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const empreinte = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const FIGEE_MS = 10000; // une page qui ne répond plus au bout de ce délai est figée (boucle infinie, calcul énorme)

/** `p`, ou une erreur `figée` si la page ne répond pas dans le délai. */
function delai(p, ms, quoi) {
  p.catch(() => {}); // la promesse abandonnée finit par échouer à la fermeture de la page
  return Promise.race([p, pause(ms).then(() => { throw Object.assign(new Error(`page figée (${quoi})`), { figee: true }); })]);
}

// ---------- Jeu de données « exemple » (docs/modele-donnees.md) ----------

export function isoLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${off >= 0 ? "+" : "-"}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

/** Deux rotations du Bloc Force (S1 puis S2), une séance tous les deux jours, finies il y a deux jours. */
export function donneesExemple() {
  const prog = JSON.parse(readFileSync(new URL("../src/donnees/programmes/bloc-force.json", import.meta.url))).programmes[0];
  const pdc = 82;
  const rm = { "developpe-couche": 120, "hack-squat": 160, "tractions-lestees": 115, "souleve-de-terre": 180 };
  const base = { "developpe-incline-halteres": 28, "dips-lestes": 10, "mollets-debout": 60, "hip-thrust": 100, "leg-curl-assis": 45,
    "rowing-barre": 70, "rowing-haltere": 32, "developpe-militaire-barre": 50, "fentes-bulgares": 16, "crunch-poulie-haute": 40 };
  const lestes = new Set(["tractions-lestees", "dips-lestes"]);
  const arrondi = (kg) => Math.round(kg / 2.5) * 2.5;
  const jours = prog.jours.length * 2;
  const debutBloc = new Date(Date.now() - (2 + 2 * (jours - 1)) * 86400e3);
  debutBloc.setHours(18, 0, 0, 0);
  const idBloc = `${isoLocal(debutBloc).slice(0, 10)}-bloc-force`;
  const mois = {};
  for (let n = 0; n < jours; n++) {
    const semaine = Math.floor(n / prog.jours.length);
    const jour = prog.jours[n % prog.jours.length];
    const d = new Date(debutBloc.getTime() + 2 * n * 86400e3);
    let t = d.getTime();
    const serie = (kg, reps, rir) => {
      t += 150e3;
      return { type: "travail", kg, reps, rir, prevu: { kg, reps }, a: isoLocal(new Date(t)) };
    };
    const exercices = [];
    for (const e of jour.exercices) {
      const p = e.prescription;
      if (p.type === "distance" || e.optionnel) continue; // jour réaliste : options sautées
      for (const exo of e.superset ?? [e.exo]) {
        let series;
        if (p.type === "pct1rm") {
          const s = prog.semaines[semaine].schemas[p.schema];
          const total = s.pct[0] * (rm[exo] ?? 100);
          const kg = arrondi(lestes.has(exo) ? total - pdc : total);
          series = [{ type: "echauffement", kg: arrondi(kg * 0.6), reps: 5 },
            ...Array.from({ length: s.series }, () => serie(kg, s.reps, 2))];
        } else {
          const kg = (base[exo] ?? 20) + (semaine ? 2.5 : 0);
          series = Array.from({ length: p.series ?? 3 }, (_, i) => serie(kg, p.repsMax ?? 10, i === 2 ? 1 : 2));
        }
        exercices.push({ exo, series });
      }
    }
    const cle = isoLocal(d).slice(0, 7);
    (mois[cle] ??= []).push({ debut: isoLocal(d), fin: isoLocal(new Date(t + 120e3)), bloc: idBloc, programme: "bloc-force",
      semaine, jour: jour.id, salle: "salle-1", exercices });
  }
  const fichiers = {
    "reglages.json": { format: 1, theme: "braise", programme: "bloc-force", sexe: "homme", prenom: "Testeur", langue: "fr", envoi: false },
    "poids.json": { format: 1, pesees: [{ date: idBloc.slice(0, 10), kg: pdc, le: isoLocal(debutBloc) }] },
    "blocs.json": { format: 1, blocs: [{ id: idBloc, programme: "bloc-force", debut: idBloc.slice(0, 10), fin: null, rm }] },
    "salles.json": { format: 1, salles: [{ id: "salle-1", nom: "Ma salle", machines: { "hack-squat": { aVide: 40 } } }] },
  };
  for (const [m, seances] of Object.entries(mois)) fichiers[`journal/${m}.json`] = { format: 1, seances };
  return Object.fromEntries(Object.entries(fichiers).map(([k, v]) => [k, JSON.stringify(v, null, 2)]));
}

// ---------- Serveur de dev ----------

async function repond(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
}

export async function lancerDev() {
  if (await repond(URL_APP)) return null;
  const p = spawn("npm run dev", { shell: true, stdio: "ignore", cwd: RACINE });
  for (let i = 0; i < 60; i++) {
    if (await repond(URL_APP)) return p;
    if (p.exitCode !== null) throw new Error(`npm run dev s'est arrêté (code ${p.exitCode})`);
    await pause(1000);
  }
  arreterDev(p);
  throw new Error(`${URL_APP} ne répond pas 60 s après npm run dev`);
}

export function arreterDev(p) {
  if (!p || p.exitCode !== null) return;
  // shell: true → l'arbre npm / node / vite ; sous Windows seul taskkill /T le ferme en entier.
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(p.pid), "/T", "/F"], () => {});
  else p.kill("SIGTERM");
}

// ---------- Ollama ----------

const mesuresIa = [];

async function ollama(messages, schema, graine, temperature = 0.6) {
  const t0 = Date.now();
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(180e3),
    body: JSON.stringify({ model: MODELE, messages, stream: false, format: schema, keep_alive: "2m",
      options: { temperature, seed: graine, num_ctx: 4096, num_predict: 300 } }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status} : ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  mesuresIa.push(Date.now() - t0);
  return JSON.parse(j.message.content); // le schéma garantit du JSON ; un JSON cassé remonte ici
}

const liberer = () => fetch(`${OLLAMA}/api/generate`, { method: "POST", body: JSON.stringify({ model: MODELE, keep_alive: 0 }) });

async function vramModele() {
  const j = await (await fetch(`${OLLAMA}/api/ps`)).json();
  const m = j.models?.find((x) => x.name === MODELE);
  return m ? Math.round(m.size_vram / 2 ** 20) : null;
}

/** Pic de mémoire vidéo de la carte (nvidia-smi), relevé toutes les 2 s. */
function suivreVram() {
  const s = { pic: null, debut: null, absent: false };
  const lire = () => execFile("nvidia-smi", ["--query-gpu=memory.used", "--format=csv,noheader,nounits"], (err, out) => {
    if (err) { s.absent = true; return; }
    const v = Number(out.trim().split("\n")[0]);
    s.debut ??= v;
    s.pic = Math.max(s.pic ?? 0, v);
  });
  lire();
  s.minuterie = setInterval(lire, 2000);
  return s;
}

const SCHEMA_ACTION = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["click", "fill", "select", "back", "scroll", "stop"] },
    index: { type: "integer" },
    valeur: { type: "string", maxLength: 400 },
    raison: { type: "string", maxLength: 120 },
  },
  required: ["action", "index", "valeur", "raison"],
};

const SCHEMA_VISION = {
  type: "object",
  properties: {
    problemes: {
      type: "array", maxItems: 3,
      items: { type: "object", properties: {
        type: { type: "string", enum: ["texte-coupe", "chevauchement", "valeur-invalide", "autre"] },
        description: { type: "string", maxLength: 200 } }, required: ["type", "description"] },
    },
  },
  required: ["problemes"],
};

// ---------- Observation ----------

/** Éléments interactifs visibles, numérotés (`data-qa`), écran courant et de quoi comparer deux états. */
function observerPage(max) {
  document.querySelectorAll("[data-qa]").forEach((e) => e.removeAttribute("data-qa"));
  const sel = "button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch]";
  const net = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  const tous = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.type === "hidden" || el.type === "file" || el.closest("[hidden], [aria-hidden=true]")) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || st.visibility === "hidden" || st.display === "none") continue;
    const tag = el.tagName.toLowerCase();
    const role = tag === "a" ? "lien" : tag === "select" ? "liste" : tag === "summary" ? "depliant"
      : tag === "textarea" ? "champ" : tag === "input" ? (["checkbox", "radio"].includes(el.type) ? el.type : "champ") : "bouton";
    const texte = net(el.getAttribute("aria-label") || el.labels?.[0]?.innerText || el.placeholder || el.innerText || el.title).slice(0, 40);
    const e = { el, role, texte, actif: !el.disabled && el.getAttribute("aria-disabled") !== "true",
      vue: r.bottom > 0 && r.top < innerHeight,
      courant: el.getAttribute("aria-current") === "page" || el.getAttribute("aria-pressed") === "true" };
    if (role === "champ") { e.type = el.type || "text"; e.valeur = el.value; }
    if (role === "liste") { e.valeur = el.selectedOptions[0]?.text ?? ""; e.options = [...el.options].slice(0, 8).map((o) => net(o.text)); }
    tous.push(e);
  }
  // À l'écran d'abord : c'est là que le testeur regarde.
  const choisis = [...tous.filter((e) => e.vue), ...tous.filter((e) => !e.vue)].slice(0, max);
  const elements = choisis.map(({ el, ...e }, i) => { el.setAttribute("data-qa", String(i)); return { i, ...e }; });
  const racine = document.getElementById("racine");
  const nav = net(document.querySelector("nav [aria-current=page]")?.innerText);
  const titre = net(document.querySelector("main h1, main h2, h1, h2")?.innerText).slice(0, 40);
  const stockage = Object.keys(localStorage).sort().map((k) => k + "=" + localStorage.getItem(k)).join("\n");
  return {
    ecran: [nav, titre].filter(Boolean).join(" › ") || "(sans titre)",
    elements,
    resume: net(document.querySelector("main")?.innerText ?? document.body.innerText).slice(0, 300),
    texte: document.body.innerText,
    valeurs: [...document.querySelectorAll("input, select, textarea")].map((e) => e.value).join("|"),
    // Un choix qui ne se voit qu'au style (bouton enfoncé, dépliant ouvert) est un effet.
    aspects: [...document.querySelectorAll(sel + ", details")].map((e) =>
      [e.className, e.getAttribute("aria-pressed"), e.getAttribute("aria-expanded"), e.getAttribute("aria-current"), e.open, e.checked].join(",")).join("|"),
    stockage,
    fichiers: Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("exzifit/")).map((k) => [k.slice(8), localStorage.getItem(k)])),
    racineTexte: net(racine?.innerText).length,
    racineNoeuds: racine ? racine.querySelectorAll("*").length : 0,
    erreursApp: [...document.querySelectorAll(".erreurs .erreur")].map((e) => net(e.innerText)),
    // Texte plus large que sa boîte (bouton, titre, libellé) : coupé ou qui déborde sur le voisin.
    debordements: [...document.querySelectorAll("main *, nav *")]
      .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "auto" &&
        [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
      .map((e) => net(e.innerText).slice(0, 40)),
    url: location.href,
  };
}

async function observer(page) {
  const o = await delai(page.evaluate(observerPage, MAX_ELEMENTS), FIGEE_MS, "observation");
  o.signature = empreinte(o.ecran + JSON.stringify(o.elements.map(({ role, texte, valeur, actif, courant }) => [role, texte, valeur, actif, courant])));
  o.effet = empreinte(o.texte + o.valeurs + o.aspects + o.stockage + o.url);
  o.controle = Object.entries(o.fichiers).flatMap(([chemin, texte]) => controlerFichier(chemin, texte));
  return o;
}

/** Attend que le texte de la page ne bouge plus (300 ms), 3 s au plus. */
async function stabiliser(page) {
  let avant = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    const ici = await delai(page.evaluate(() => document.body.innerHTML.length + ":" + document.body.innerText), 3000, "stabilité").catch(() => null);
    if (ici !== null && ici === avant) return;
    avant = ici;
    await pause(150);
  }
}

// ---------- Décision ----------

function decrireElement(e, faits) {
  let s = `${e.i} ${e.role}${e.type && e.type !== "text" ? "/" + e.type : ""} "${e.texte}"`;
  if (e.valeur !== undefined) s += ` valeur="${String(e.valeur).slice(0, 20)}"`;
  if (e.options) s += ` options=[${e.options.join(", ")}]`;
  if (!e.actif) s += " [désactivé]";
  if (e.courant) s += " [courant]";
  if (!e.vue) s += " [hors écran]";
  if (faits.get(e.texte)) s += ` [déjà touché ${faits.get(e.texte)}×]`;
  return s;
}

function decrireAction(a, etat) {
  const e = etat.elements[a.index];
  const cible = e ? `${e.role} « ${e.texte} »` : "";
  switch (a.action) {
    case "click": return `Toucher ${cible}`;
    case "fill": return a.valeur.length > 40
      ? `Saisir « ${a.valeur.slice(0, 20)}… » (${a.valeur.length} caractères) dans ${cible}` : `Saisir « ${a.valeur} » dans ${cible}`;
    case "select": return `Choisir « ${a.valeur} » dans ${cible}`;
    case "back": return "Retour (historique du navigateur)";
    case "scroll": return `Défiler vers le ${a.valeur === "haut" ? "haut" : "bas"}`;
    default: return "Arrêter";
  }
}

/** Message d'erreur si l'action est inapplicable sur cet état, sinon null. */
function invalide(a, etat, etape, total) {
  if (!a || typeof a !== "object") return "réponse vide";
  if (!SCHEMA_ACTION.properties.action.enum.includes(a.action)) return `action inconnue « ${a.action} »`;
  if (a.action === "stop") return etape < total * 0.8 ? "trop tôt pour s'arrêter, continue d'explorer" : null;
  if (!["click", "fill", "select"].includes(a.action)) return null;
  const e = etat.elements[a.index];
  if (!e) return `index ${a.index} absent de la liste`;
  if (!e.actif) return `l'élément ${a.index} est désactivé`;
  if (a.action === "click" && e.role === "liste") return `l'élément ${a.index} est une liste : select, pas click`;
  if (a.action === "fill" && e.role !== "champ") return `l'élément ${a.index} n'est pas un champ`;
  if (a.action === "select" && e.role !== "liste") return `l'élément ${a.index} n'est pas une liste`;
  if (a.action === "select" && !e.options.includes(a.valeur)) return `« ${a.valeur} » n'est pas une option de ${a.index}`;
  return null;
}

const VALEURS_PIEGES = ["", "-5", "0", "99999999", "1e9", "abc", "😀💪", "<b>x</b>", "'; DROP", "x".repeat(300), "12,5", "  "];
// Un champ number refuse le texte (Playwright lève une erreur) : des pièges numériques seulement.
const PIEGES_NOMBRE = ["", "-5", "0", "-0", "99999999", "1e9", "0.001", "2.555"];
const piege = (e, alea) => { const l = e.type === "number" ? PIEGES_NOMBRE : VALEURS_PIEGES; return l[Math.floor(alea() * l.length)]; };

function actionAleatoire(etat, alea, exclues = new Set()) {
  const possibles = [];
  for (const e of etat.elements) {
    if (!e.actif) continue;
    if (e.role === "champ") possibles.push({ action: "fill", index: e.i, valeur: piege(e, alea) });
    else if (e.role === "liste") possibles.push({ action: "select", index: e.i, valeur: e.options[Math.floor(alea() * e.options.length)] });
    else possibles.push({ action: "click", index: e.i, valeur: "" });
  }
  possibles.push({ action: "scroll", index: -1, valeur: "bas" });
  const restantes = possibles.filter((a) => !exclues.has(`${a.action}:${a.index}`));
  const parmi = restantes.length ? restantes : possibles;
  return { ...parmi[Math.floor(alea() * parmi.length)], raison: "tirage aléatoire" };
}

/** Clic sur le bouton ou lien le moins touché jusqu'ici (sortir d'un écran où l'IA tourne en rond). */
function actionNeuve(etat, faits, alea) {
  const cibles = etat.elements.filter((e) => e.actif && ["bouton", "lien", "depliant"].includes(e.role));
  if (!cibles.length) return actionAleatoire(etat, alea);
  const min = Math.min(...cibles.map((e) => faits.get(e.texte) ?? 0));
  const moins = cibles.filter((e) => (faits.get(e.texte) ?? 0) === min);
  return { action: "click", index: moins[Math.floor(alea() * moins.length)].i, valeur: "", raison: "élément le moins touché" };
}

async function decider(o, etat, historique, ecransVus, etape, faits, surEcran) {
  const systeme =
    "Tu es un testeur QA qui explore une app mobile de musculation (ExziFit, en français) pour y trouver des bugs. " +
    `Objectif : ${o.objectif} ` +
    "À chaque tour, choisis UNE action sur un élément de la liste, par son index. Va vers les écrans pas encore vus, " +
    "n'insiste pas sur ce qui ne change rien ni sur un élément [déjà touché]. Pour fill, valeur = texte à taper. " +
    "raison : une phrase courte. " +
    "click/fill/select : index obligatoire ; back/scroll/stop : index -1, valeur \"haut\" ou \"bas\" pour scroll.";
  const utilisateur = [
    `Étape ${etape}/${o.etapes}. Écran : ${etat.ecran} (depuis ${surEcran} étape(s))`,
    `Écrans déjà vus : ${[...ecransVus].join(" ; ")}`,
    `Texte visible : ${etat.resume}`,
    "Éléments :", ...etat.elements.map((e) => decrireElement(e, faits)),
    "Dernières actions :", ...(historique.length ? historique.slice(-10).map((h) => `- ${h.description} → ${h.resultat}`) : ["(aucune)"]),
  ].join("\n");
  const messages = [{ role: "system", content: systeme }, { role: "user", content: utilisateur }];
  let a = null;
  let erreur;
  const refus = [];
  for (const essai of [1, 2]) {
    try {
      a = await ollama(messages, SCHEMA_ACTION, o.graine + etape * 7 + essai);
      erreur = invalide(a, etat, etape, o.etapes);
    } catch (e) {
      erreur = `réponse illisible (${e.message})`;
    }
    if (!erreur) return { ...a, source: essai === 1 ? "ia" : "ia-2e-essai", refus };
    refus.push(erreur);
    messages.push({ role: "assistant", content: JSON.stringify(a) }, { role: "user", content: `Action refusée : ${erreur}. Choisis une autre action valide.` });
  }
  return { refus }; // pas d'action : l'appelant en tire une au hasard
}

// ---------- Action ----------

async function agir(page, a, compteurs) {
  const cible = page.locator(`[data-qa="${a.index}"]`);
  const avant = compteurs.telechargements;
  try {
    switch (a.action) {
      case "click": await cible.click({ timeout: 3000 }); break;
      case "fill": await cible.fill(a.valeur, { timeout: 3000 }); break;
      case "select": await cible.selectOption({ label: a.valeur }, { timeout: 3000 }); break;
      case "scroll": await page.mouse.wheel(0, a.valeur === "haut" ? -600 : 600); break;
      case "back":
        // La navigation est un état React, sans historique : revenir avant la page, ce serait quitter l'app.
        if (!(await page.evaluate(() => navigation.canGoBack && navigation.currentEntry.index > 0)))
          return { resultat: "rien : pas d'historique dans le navigateur (retour Android testable seulement sur l'APK)" };
        await page.goBack({ timeout: 3000 });
        break;
    }
  } catch (e) {
    // Champ number qui refuse « abc », élément recouvert… : refus de Playwright, pas une erreur de l'app.
    return { resultat: "refusée : " + e.message.split("\n")[0].slice(0, 120) };
  }
  await stabiliser(page);
  return { resultat: "ok", telechargement: compteurs.telechargements > avant };
}

// ---------- Boucle ----------

async function main() {
  const o = options(process.argv.slice(2));
  const lancement = new Date();
  const dossier = join(RACINE, "qa-rapports", isoLocal(lancement).slice(0, 19).replace(/[:T]/g, "-"));
  mkdirSync(dossier, { recursive: true });
  const journal = join(dossier, "journal.jsonl");
  writeFileSync(journal, "");
  const alea = hasard(o.graine);

  if (!(await repond(`${OLLAMA}/api/tags`))) throw new Error(`Ollama ne répond pas sur ${OLLAMA} (ollama serve ?)`);
  const vram = suivreVram();
  const serveur = await lancerDev();
  let navigateur;
  let arret = false;
  process.on("SIGINT", () => { arret = true; console.log("\nArrêt demandé : fin de l'étape en cours puis rapport."); });

  const problemes = new Map(); // clé de dédoublonnage → problème
  const historique = [];
  const ecransVus = new Set();
  const tapes = new Set(); // valeurs saisies par l'agent : leur réaffichage n'est pas un « NaN » de l'app
  const compteurs = { telechargements: 0 };
  const faits = new Map(); // texte d'élément → nombre d'actions dessus
  let tampon = []; // erreurs de page arrivées pendant l'étape
  let modeleVram = null;
  const t0 = Date.now();
  let fatale = null;

  try {
    navigateur = await chromium.launch({ headless: !o.visible });
    const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", acceptDownloads: true });
    const ouvrir = async () => {
    const page = await contexte.newPage();
    await page.exposeFunction("__qaRejet", (m) => tampon.push({ type: "rejet", message: m.split("\n")[0], trace: m }));
    await page.addInitScript(() => addEventListener("unhandledrejection", (e) =>
      window.__qaRejet(String(e.reason?.stack ?? e.reason))));
    page.on("pageerror", (e) => tampon.push({ type: "pageerror", message: e.message, trace: e.stack ?? "" }));
    page.on("console", (m) => {
      if (m.type() !== "error" || m.text().startsWith("Uncaught (in promise)")) return; // rejets : déjà par __qaRejet
      const l = m.location();
      tampon.push({ type: "console.error", message: m.text().split("\n")[0], trace: `${m.text()}\n    at ${l.url}:${l.lineNumber}:${l.columnNumber}` });
    });
    page.on("dialog", (d) => d.dismiss().catch(() => {}));
    page.on("download", () => compteurs.telechargements++);
    return page;
    };
    let page = await ouvrir();

    await page.goto(URL_APP);
    if (o.donnees === "exemple") {
      await page.evaluate((f) => { localStorage.clear(); for (const [k, v] of Object.entries(f)) localStorage.setItem("exzifit/" + k, v); }, donneesExemple());
      await page.reload();
    }
    await stabiliser(page);
    tampon = tampon.filter((x) => x.type !== "console.error" || !/Failed to load resource/.test(x.message));

    let etat = await observer(page);
    if (etat.controle.length) throw new Error(`données de départ déjà fautives (jeu « ${o.donnees} ») :\n${etat.controle.join("\n")}`);
    let memeEtat = 0;
    let surEcran = 0;
    let ecranPrecedent = null;
    const essaisSurEtat = new Map(); // signature → actions déjà tentées

    const capture = async (n) => {
      const nom = `etape-${String(n).padStart(3, "0")}.png`;
      await page.screenshot({ path: join(dossier, nom) });
      return nom;
    };
    const signaler = (cle, p, etape, captureNom) => {
      const deja = problemes.get(cle);
      if (deja) { if (deja.occurrences.at(-1) !== etape) deja.occurrences.push(etape); return; } // React (dev) relance une erreur deux fois
      problemes.set(cle, { ...p, etape, capture: captureNom, occurrences: [etape], chemin: historique.map((h) => h.description) , ecranAvant: historique.at(-1)?.ecran });
    };

    for (let n = 1; n <= o.etapes && !arret; n++) {
      const debutEtape = Date.now();
      ecransVus.add(etat.ecran);
      const tentees = essaisSurEtat.get(etat.signature) ?? new Set();
      let a;
      surEcran = etat.ecran === ecranPrecedent ? surEcran + 1 : 1;
      ecranPrecedent = etat.ecran;
      if (surEcran >= ORNIERE && surEcran % 5 === 0) {
        a = { ...actionNeuve(etat, faits, alea), source: `forcée (${surEcran} étapes sur l'écran)` };
      } else if (memeEtat >= BLOCAGE_N) {
        a = { ...actionAleatoire(etat, alea, tentees), source: "forcée (blocage)" };
      } else {
        const t = Date.now();
        a = await decider(o, etat, historique, ecransVus, n, faits, surEcran);
        if (!a.action) a = { ...actionAleatoire(etat, alea), source: "aléatoire (IA invalide)", refus: a.refus };
        a.dureeIa = Date.now() - t;
      }
      if (a.action === "stop") {
        appendFileSync(journal, JSON.stringify({ etape: n, ecran: etat.ecran, ...a }) + "\n");
        console.log(`#${n} stop : ${a.raison}`);
        break;
      }
      // Toucher un champ ne casse rien : on y tape une valeur piège à la place.
      if (a.action === "click" && etat.elements[a.index]?.role === "champ")
        a = { ...a, action: "fill", valeur: piege(etat.elements[a.index], alea), source: a.source + " (clic → saisie piège)" };
      tentees.add(`${a.action}:${a.index}`);
      essaisSurEtat.set(etat.signature, tentees);
      if (a.action === "fill") tapes.add(a.valeur);
      if (etat.elements[a.index]) faits.set(etat.elements[a.index].texte, (faits.get(etat.elements[a.index].texte) ?? 0) + 1);
      const description = decrireAction(a, etat);
      const cible = etat.elements[a.index];
      const r = await agir(page, a, compteurs);
      let figee = null;
      const apres = await observer(page).catch((e) => { if (e.figee) figee = e; return null; });
      const anomalies = [];
      if (figee) anomalies.push({ cle: `figee|${etat.ecran}|${description}`, gravite: "bug", type: "page figée",
        message: `la page ne répond plus ${FIGEE_MS / 1000} s après « ${description} » (boucle infinie ou calcul démesuré)` });

      // Erreurs JS de l'étape
      for (const err of tampon) {
        const lieu = (err.trace.match(/\((http[^)]+)\)|at (http\S+)/) ?? [])[1]?.replace(/\?t=\d+/, "") ?? "";
        anomalies.push({ cle: `${err.type}|${err.message}|${lieu}`, gravite: "bug", ...err });
      }
      tampon = [];
      if (apres) {
        if (apres.racineTexte < 3 && apres.racineNoeuds < 5)
          anomalies.push({ cle: `blanc|${etat.ecran}|${description}`, gravite: "bug", type: "écran blanc", message: `racine React vide après « ${description} »` });
        for (const d of apres.debordements)
          anomalies.push({ cle: `deborde|${d}`, gravite: "suspect", type: "débordement", message: `« ${d} » dépasse de sa boîte (scrollWidth > clientWidth)` });
        for (const m of apres.controle.filter((m) => !etat.controle.includes(m)))
          anomalies.push({ cle: `donnee|${m.replace(/\d+/g, "#")}`, gravite: "bug", type: "donnée impossible", message: `enregistré : ${m}` });
        for (const m of apres.erreursApp.filter((m) => !etat.erreursApp.includes(m)))
          anomalies.push({ cle: `app|${m.replace(/\d+/g, "#")}`, gravite: "bug", type: "erreur affichée", message: m });
        const mauvais = [...new Set(apres.texte.match(/\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/g) ?? [])]
          .filter((m) => ![...tapes].some((v) => v.includes(m)));
        for (const m of mauvais) anomalies.push({ cle: `texte|${apres.ecran}|${m}`, gravite: "bug", type: "texte invalide", message: `« ${m} » affiché sur ${apres.ecran}` });
        if (r.resultat === "ok" && a.action === "click" && ["bouton", "lien", "depliant"].includes(cible?.role) && cible.actif && !cible.courant && !r.telechargement && apres.effet === etat.effet)
          anomalies.push({ cle: `effet|${etat.ecran}|${cible.texte}`, gravite: "suspect", type: "sans effet", message: `« ${cible.texte} » ne change ni l'écran, ni les valeurs, ni les données` });
        memeEtat = apres.signature === etat.signature ? memeEtat + 1 : 0;
        if (memeEtat === BLOCAGE_N)
          anomalies.push({ cle: `blocage|${apres.signature}`, gravite: "suspect", type: "blocage", message: `même état ${BLOCAGE_N} fois de suite sur ${apres.ecran} : action forcée` });
      }

      const resultat = r.resultat === "ok" ? (apres && apres.effet === etat.effet ? "aucun changement" : `ok → ${apres?.ecran}`) : r.resultat;
      historique.push({ etape: n, ecran: etat.ecran, description, resultat });

      // Vision : toutes les K étapes et à chaque anomalie, après l'action
      let nomCapture = null;
      let vision = null;
      if (apres && (anomalies.length || n % o.vision === 0)) {
        nomCapture = await capture(n);
        const image = readFileSync(join(dossier, nomCapture)).toString("base64");
        try {
          vision = (await ollama([{ role: "user", images: [image], content:
            "Capture d'un écran d'app mobile. Signale seulement les défauts visibles évidents : texte coupé ou qui déborde, " +
            "éléments qui se chevauchent, valeur affichée NaN, undefined, null ou [object Object]. Un texte entier qui tient dans sa boîte n'est pas coupé. " +
            "Dans le doute, ne signale rien : liste vide." }],
            SCHEMA_VISION, o.graine + n, 0)).problemes ?? [];
        } catch (e) {
          vision = [];
          console.log(`  vision illisible : ${e.message}`);
        }
        for (const v of vision)
          anomalies.push({ cle: `vision|${apres.ecran}|${v.type}`, gravite: "suspect", type: `vue : ${v.type}`, message: v.description });
      }
      for (const an of anomalies) signaler(an.cle, an, n, nomCapture);

      const ligne = { etape: n, ecran: etat.ecran, action: a.action, index: a.index, cible: cible?.texte, valeur: a.valeur, raison: a.raison,
        source: a.source, refus: a.refus?.length ? a.refus : undefined, description, resultat, ecranApres: apres?.ecran, dureeMs: Date.now() - debutEtape, dureeIaMs: a.dureeIa,
        anomalies: anomalies.map(({ cle, ...x }) => x), vision, capture: nomCapture };
      appendFileSync(journal, JSON.stringify(ligne) + "\n");
      console.log(`#${n} [${a.source}] ${description} → ${resultat}${anomalies.length ? `  ⚠ ${anomalies.map((x) => x.type).join(", ")}` : ""}`);

      if (!apres) { // page figée ou morte : nouvel onglet sur l'app (même localStorage) pour continuer
        console.log(`  page illisible (${figee ? "figée" : page.url()}) : nouvel onglet sur ${URL_APP}`);
        await delai(page.close(), 5000, "fermeture").catch(() => {});
        page = await ouvrir();
        await delai(page.goto(URL_APP), FIGEE_MS, "réouverture").catch(() => {});
        await stabiliser(page);
      }
      try {
        etat = apres ?? (await observer(page));
      } catch (e) {
        if (!e.figee) throw e;
        signaler(`reouverture|${description}`, { gravite: "bug", type: "app figée à la réouverture",
          message: `après « ${description} », l'app rouverte dans un nouvel onglet (mêmes données) ne répond plus : ` +
            "une donnée enregistrée la fige peut-être à chaque lancement. Session arrêtée." }, n, null);
        console.log("  app toujours figée à la réouverture : fin de session");
        break;
      }
      if (n === 1 || n % 10 === 0) modeleVram = (await vramModele().catch(() => null)) ?? modeleVram;
    }
  } catch (e) {
    fatale = e; // rapport écrit quand même, puis l'erreur remonte
  } finally {
    await navigateur?.close();
    arreterDev(serveur);
    clearInterval(vram.minuterie);
    modeleVram = (await vramModele().catch(() => null)) ?? modeleVram;
    await liberer().catch((e) => console.log(`Libération de la mémoire vidéo impossible : ${e.message}`));
  }

  const duree = Date.now() - t0;
  const etapes = historique.length;
  const moy = (t) => (t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : 0);
  const mesures = {
    etapes, dureeS: Math.round(duree / 1000), parEtapeMs: Math.round(duree / Math.max(etapes, 1)),
    appelIaMs: moy(mesuresIa), appelsIa: mesuresIa.length,
    vramModeleMo: modeleVram, vramPicMo: vram.absent ? null : vram.pic, vramAvantMo: vram.absent ? null : vram.debut,
  };
  writeFileSync(join(dossier, "rapport.md"), rapport(o, lancement, mesures, [...problemes.values()], ecransVus, fatale));
  console.log(`\nRapport : ${join(dossier, "rapport.md")}`);
  console.log(JSON.stringify(mesures));
  if (fatale) throw fatale;
}

// ---------- Rapport ----------

function rapport(o, lancement, m, problemes, ecransVus, fatale) {
  const bugs = problemes.filter((p) => p.gravite === "bug");
  const suspects = problemes.filter((p) => p.gravite === "suspect");
  const l = [
    `# Rapport QA — ${isoLocal(lancement).slice(0, 16).replace("T", " ")}`, "",
    `- Objectif : ${o.objectif}`,
    `- Données de départ : **${o.donnees}** · graine ${o.graine} · modèle ${MODELE}`,
    `- ${m.etapes} étapes sur ${o.etapes} en ${m.dureeS} s : **${(m.parEtapeMs / 1000).toFixed(1)} s par étape**, ` +
      `${m.appelsIa} appels à l'IA de ${(m.appelIaMs / 1000).toFixed(1)} s en moyenne`,
    `- Mémoire vidéo : modèle ${m.vramModeleMo ?? "?"} Mo (Ollama), carte ${m.vramAvantMo ?? "?"} Mo au départ, pic ${m.vramPicMo ?? "?"} Mo (nvidia-smi)`,
    `- Écrans vus (${ecransVus.size}) : ${[...ecransVus].join(" ; ")}`,
    ...(fatale ? [`- **Session interrompue par une erreur du script** : ${fatale.message}`] : []), "",
    "## Résumé", "",
    `**${bugs.length} problème(s)** (erreurs JS, écran blanc, erreur affichée, texte invalide) et **${suspects.length} suspect(s)** ` +
      "(action sans effet, blocage, avis de l'IA sur la capture : à vérifier à l'œil, pas des bugs sûrs).", "",
    "Reproduire : `npm run dev`, navigateur neuf à 390 × 844" +
      (o.donnees === "exemple" ? ", localStorage rempli par le jeu « exemple » de `scripts/qa-ia.mjs` (`donneesExemple`)" : ", localStorage vide") +
      ", puis les actions listées dans l'ordre.", "",
  ];
  const bloc = (titre, liste) => {
    if (!liste.length) return;
    l.push(`## ${titre}`, "");
    liste.forEach((p, i) => {
      l.push(`### ${i + 1}. ${p.type} — étape ${p.etape}${p.occurrences.length > 1 ? ` (${p.occurrences.length} fois : étapes ${p.occurrences.join(", ")})` : ""}`, "");
      l.push(`**${p.message}**`, "");
      if (p.trace) l.push("```", p.trace.split("\n").slice(0, 8).join("\n"), "```", "");
      const chemin = p.chemin;
      const debut = Math.max(0, chemin.length - 5);
      l.push(`Chemin (${chemin.length} actions) :`, "");
      if (debut > 0) {
        l.push("<details><summary>Actions 1 à " + debut + "</summary>", "");
        chemin.slice(0, debut).forEach((c, j) => l.push(`${j + 1}. ${c}`));
        l.push("", "</details>", "");
      }
      chemin.slice(debut).forEach((c, j) => l.push(`${debut + j + 1}. ${c}`));
      l.push("");
      if (p.capture) l.push(`![étape ${p.etape}](${p.capture})`, "");
    });
  };
  bloc("Problèmes", bugs);
  bloc("Suspects", suspects);
  if (!problemes.length) l.push("Rien de détecté.", "");
  return l.join("\n");
}

// Importé (pour réutiliser `donneesExemple`), le script ne lance rien.
if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
