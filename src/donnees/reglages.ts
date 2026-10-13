import { estTheme, THEME_DEFAUT, type IdTheme } from "../themes";
import { ecrireJson, FORMAT, lireJson } from "./fichier";

const CHEMIN = "reglages.json";

export interface Reglages {
  format: number;
  theme: IdTheme;
}

export async function lireReglages(): Promise<Reglages> {
  const r = await lireJson<Reglages>(CHEMIN, () => ({ format: FORMAT, theme: THEME_DEFAUT }));
  // Un thème retiré d'une version à l'autre ne doit pas empêcher l'app de s'ouvrir.
  return estTheme(r.theme) ? r : { ...r, theme: THEME_DEFAUT };
}

export const ecrireReglages = (r: Reglages) => ecrireJson(CHEMIN, r);
