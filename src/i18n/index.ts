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

/**
 * Première langue proposée dans les langues du téléphone, dans l'ordre choisi par l'utilisateur ;
 * sinon l'anglais. On lit la langue, jamais le pays : « fr-BE » donne le français, pas le
 * néerlandais ; « nl-BE » puis « fr-BE » donne aussi le français (le néerlandais n'est pas proposé).
 */
export function langueDe(liste: readonly string[]): Langue {
  for (const x of liste) {
    const n = x.toLowerCase();
    if (n.startsWith("fr")) return "fr";
    if (n.startsWith("pt")) return "pt-BR";
    if (n.startsWith("en")) return "en";
  }
  return "en";
}

export function langueDuSysteme(): Langue {
  if (typeof navigator === "undefined") return "fr";
  return langueDe(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

/** Change `t` seulement ; `appliquerLangue` (langue.ts) traduit aussi exercices et programmes. */
export function poserLangue(l: Langue): void {
  t = TEXTES[l];
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export type { Textes };
