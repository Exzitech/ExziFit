// Illustrations des exos : télécharge les deux images (départ, fin) de chaque exo listé dans
// src/illustrations/sources.json, les réduit et les écrit en WebP dans src/illustrations/.
// Les .webp sont générés : on change sources.json et on relance, on ne les retouche jamais.
//
// Sources (README, « Illustrations des exos ») :
// - ek : dessins Everkinetic, CC-BY-SA 3.0 (copie du site disparu : github.com/JAlbertoGonzalez/everkinetic-data)
// - ek-wger : dessins Everkinetic absents de cette copie, pris chez wger.de (même licence)
// - fedb : photos de free-exercise-db (github.com/yuhonas/free-exercise-db), Unlicense
//
// node scripts/illustrations.mjs

import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DOSSIER = fileURLToPath(new URL("../src/illustrations/", import.meta.url));
const EK = "https://raw.githubusercontent.com/JAlbertoGonzalez/everkinetic-data/master/";
const FEDB = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
/** Hauteur écrite : la plus grande vue (pli « Technique ») fait 150 px CSS, × 2 pour les écrans denses. */
const HAUTEUR = 300;

async function telecharger(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} : HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Fichiers des deux temps d'un dessin Everkinetic (`squats-1.png`, `hack-squat-2-856x1024.png`…). */
function fichiersEk(arbre, cle) {
  return [1, 2].map((n) => {
    const re = new RegExp(`^img/${cle}-${n}(-\\d+x\\d+)?\\.(png|gif)$`);
    const trouves = arbre.filter((p) => re.test(p)).sort((a, b) => a.length - b.length);
    if (!trouves.length) throw new Error(`Everkinetic : pas d'image ${n} pour « ${cle} »`);
    return EK + trouves[0];
  });
}

const sources = JSON.parse(readFileSync(join(DOSSIER, "sources.json"), "utf8"));
const arbre = (await (await fetch("https://api.github.com/repos/JAlbertoGonzalez/everkinetic-data/git/trees/master?recursive=1")).json())
  .tree.map((x) => x.path);

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
const ecrits = new Set(["sources.json"]);
let total = 0;

for (const [id, [source, cle]] of Object.entries(sources)) {
  const urls = source === "ek" ? fichiersEk(arbre, cle)
    : source === "ek-wger" ? [1, 2].map((n) => `https://wger.de/media/exercise-images/${cle}-${n}.png`)
    : source === "fedb" ? [0, 1].map((n) => `${FEDB}${cle}/${n}.jpg`)
    : null;
  if (!urls) throw new Error(`${id} : source inconnue « ${source} »`);
  const brutes = await Promise.all(urls.map(telecharger));
  // Dessins : recadrés sur le trait (même cadre pour les deux temps, l'échelle ne saute pas), puis
  // trait noir sur fond transparent, que l'app colore avec le thème (masque CSS).
  const sorties = await page.evaluate(async ({ images, trait, hauteur }) => {
    const charger = (b64) => new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("image illisible"));
      i.src = `data:image;base64,${b64}`;
    });
    const imgs = await Promise.all(images.map(charger));
    const toile = (l, h) => Object.assign(document.createElement("canvas"), { width: l, height: h });
    let cadre = { x: 0, y: 0, l: imgs[0].naturalWidth, h: imgs[0].naturalHeight };
    if (trait) {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (const i of imgs) {
        const c = toile(i.naturalWidth, i.naturalHeight), g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4] < 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        }
      }
      const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
      cadre = { x: x0 - m, y: y0 - m, l: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
    }
    return imgs.map((i) => {
      const k = Math.min(1, hauteur / cadre.h);
      const c = toile(Math.round(cadre.l * k), Math.round(cadre.h * k)), g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = "high";
      g.drawImage(i, cadre.x, cadre.y, cadre.l, cadre.h, 0, 0, c.width, c.height);
      if (trait) {
        const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
        for (let k = 0; k < d.length; k += 4) {
          const a = 255 - Math.round((d[k] + d[k + 1] + d[k + 2]) / 3);
          d[k] = d[k + 1] = d[k + 2] = 0;
          d[k + 3] = a < 24 ? 0 : a; // le gris très clair (bruit des sources) devient fond
        }
        g.putImageData(px, 0, 0);
      }
      return c.toDataURL("image/webp", 0.8).split(",")[1];
    });
  }, { images: brutes.map((b) => b.toString("base64")), trait: source !== "fedb", hauteur: HAUTEUR });
  sorties.forEach((b64, n) => {
    const nom = `${id}-${n + 1}.webp`;
    const octets = Buffer.from(b64, "base64");
    writeFileSync(join(DOSSIER, nom), octets);
    ecrits.add(nom);
    total += octets.length;
  });
  console.log(`${id} ← ${source} ${cle}`);
}
await navigateur.close();

// Exo retiré de sources.json : ses images partent aussi.
for (const f of readdirSync(DOSSIER)) if (f.endsWith(".webp") && !ecrits.has(f)) unlinkSync(join(DOSSIER, f));
console.log(`${ecrits.size - 1} images, ${Math.round(total / 1024)} Ko`);
