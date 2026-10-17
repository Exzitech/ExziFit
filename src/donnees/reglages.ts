import type { Langue } from "../i18n";
import { estTheme, THEME_DEFAUT, type IdTheme } from "../themes";
import { stockage } from "../stockage";
import { ecrireJson, FORMAT, lireJson } from "./fichier";
import type { Sexe } from "./stats";

const CHEMIN = "reglages.json";

export interface Reglages {
  format: number;
  theme: IdTheme;
  /** Programme choisi sur l'accueil ; absent = le Bloc Force (programme.ts, `PROGRAMME_DEFAUT`). */
  programme?: string;
  /** Références de Force et dessin du personnage ; absent = homme. */
  sexe?: Sexe;
  /** Langue de l'interface ; absent = celle du téléphone (`langueDuSysteme`). */
  langue?: Langue;
  /** Saisi au premier lancement, titre de l'onglet Perso. */
  prenom?: string;
  /** Envoi des sauvegardes sur Nextcloud, dans le dossier de Tom (lien dans l'APK). Absent = actif :
   *  seule l'installation de Tom date d'avant l'accueil du premier lancement, qui écrit `false`. */
  envoi?: boolean;
}

/** `null` au premier lancement (ni réglages ni séance) : l'écran de bienvenue les crée. */
export async function lireReglages(): Promise<Reglages | null> {
  if ((await stockage.lire(CHEMIN)) === null && (await stockage.lister("journal")).length === 0) return null;
  const r = await lireJson<Reglages>(CHEMIN, () => ({ format: FORMAT, theme: THEME_DEFAUT }));
  // Un thème retiré d'une version à l'autre ne doit pas empêcher l'app de s'ouvrir.
  return estTheme(r.theme) ? r : { ...r, theme: THEME_DEFAUT };
}

export const ecrireReglages = (r: Reglages) => ecrireJson(CHEMIN, r);
