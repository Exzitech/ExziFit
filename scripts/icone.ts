/**
 * Icône de l'app : le personnage de l'onglet Perso (avatar.ts), couleurs du thème Braise.
 * `npm run icone` écrit les sources dans icone/ puis `tauri icon` en tire toutes les
 * tailles (bureau et Android). Les PNG générés ne se retouchent pas à la main.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { bandes, grille, HAUTEUR, LARGEUR } from "../src/donnees/avatar";

const COTE = 1024;
// Index = valeur de Px (Vide, Peau, Cheveux, Yeux, Short, Ombre, Chaussures), comme styles.css.
const COULEURS = ["", "#e0ab83", "#5a3a24", "#15110f", "#ff8a3d", "#b97b55", "#f3e9df"];
const FOND = "#15110f";
const DOSSIER = "icone/";

mkdirSync(DOSSIER, { recursive: true });
const sprite = bandes(grille({ force: 4, endurance: 3, constance: 1 }, "homme"));

/** `pixel` = côté d'un pixel du sprite, centré sur un carré de COTE ; `fond` absent = transparent. */
function svg(pixel: number, fond?: string) {
  const x0 = (COTE - LARGEUR * pixel) / 2;
  const y0 = (COTE - HAUTEUR * pixel) / 2;
  const rects = sprite
    .map((b) => `<rect x="${x0 + b.x * pixel}" y="${y0 + b.y * pixel}" width="${b.l * pixel}" height="${pixel}" fill="${COULEURS[b.c]}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COTE}" height="${COTE}" viewBox="0 0 ${COTE} ${COTE}" shape-rendering="crispEdges">` +
    (fond ? `<rect width="${COTE}" height="${COTE}" fill="${fond}"/>` : "") + `${rects}</svg>\n`;
}

// Icône pleine (bureau, anciens lanceurs) : sprite de 672 × 756, marge pour les masques ronds.
writeFileSync(DOSSIER + "icone.svg", svg(28, FOND));
// Premier plan de l'icône adaptative Android : seul le disque central (66 % du côté) reste visible
// après le masque, d'où un sprite de 504 × 567.
writeFileSync(DOSSIER + "icone-avant.svg", svg(21));
writeFileSync(DOSSIER + "icone.json", JSON.stringify(
  { default: "icone.svg", bg_color: FOND, android_fg: "icone-avant.svg", android_fg_scale: 100 }, null, 2) + "\n");
