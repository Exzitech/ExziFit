import { en } from "./en";
import { fr, type Textes } from "./fr";
import { pt } from "./pt";

/**
 * Langue de l'interface. Les données restent en identifiants (exos, jours, programmes) : changer de
 * langue ne touche à aucun fichier. `t` est une liaison vivante (`export let`) : lue au rendu, elle
 * suit `poserLangue` sans prop à faire descendre.
 */
export const LANGUES = [
  { id: "fr", nom: "Français" },
  { id: "en", nom: "English" },
  { id: "pt-BR", nom: "Português" },
] as const;

export type Langue = (typeof LANGUES)[number]["id"];

const TEXTES: Record<Langue, Textes> = { fr, en, "pt-BR": pt };

export let t: Textes = fr;

export const estLangue = (x: unknown): x is Langue => LANGUES.some((l) => l.id === x);

/** Langue du téléphone si elle est proposée, sinon l'anglais. */
export function langueDuSysteme(): Langue {
  const n = (typeof navigator === "undefined" ? "fr" : navigator.language).toLowerCase();
  return n.startsWith("fr") ? "fr" : n.startsWith("pt") ? "pt-BR" : "en";
}

/** Change `t` seulement ; `appliquerLangue` (langue.ts) traduit aussi exercices et programmes. */
export function poserLangue(l: Langue): void {
  t = TEXTES[l];
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export type { Textes };
