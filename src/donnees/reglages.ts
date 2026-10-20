import type { Langue } from "../i18n";
import { estTheme, THEME_DEFAUT, type IdTheme } from "../themes";
import { stockage } from "../stockage";
import { ecrireJson, FORMAT, horodatage, lireJson } from "./fichier";
import type { Sexe } from "./stats";

export const REGLAGES = "reglages.json";
const CHEMIN = REGLAGES;

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
  /** Repos changés sur les programmes fournis, en s, par poste (programme.ts, `clePoste`). */
  repos?: Record<string, number>;
  /** Dernier changement du profil (synchro : le plus récent gagne), posé par `ecrireReglages`. */
  profilModifie?: string;
}

/** Ce qui suit la personne d'un appareil à l'autre (repos des programmes compris) ; thème, langue et envoi restent à chaque appareil. */
const CHAMPS_PROFIL = ["prenom", "sexe", "programme", "repos"] as const;
export type Profil = Pick<Reglages, (typeof CHAMPS_PROFIL)[number]> & { modifie: string };

const texteProfil = (r: Partial<Reglages>) => JSON.stringify(CHAMPS_PROFIL.map((k) => r[k] ?? null));

/** Profil envoyé à la synchro ; jamais changé depuis la première écriture : rien à imposer. */
export function profilDe(r: Partial<Reglages>): Profil | null {
  if (!r.profilModifie) return null;
  const p: Profil = { modifie: r.profilModifie };
  for (const k of CHAMPS_PROFIL) if (r[k] !== undefined) Object.assign(p, { [k]: r[k] });
  return p;
}

/** Réglages de cet appareil avec le profil d'un autre (un champ absent chez lui le devient ici). */
export function avecProfil(r: Partial<Reglages>, { modifie, ...champs }: Profil): Partial<Reglages> {
  const { prenom: _p, sexe: _s, programme: _g, repos: _r, profilModifie: _m, ...reste } = r;
  return { ...reste, ...champs, profilModifie: modifie };
}

/** `null` au premier lancement (ni réglages ni séance) : l'écran de bienvenue les crée. */
export async function lireReglages(): Promise<Reglages | null> {
  if ((await stockage.lire(CHEMIN)) === null && (await stockage.lister("journal")).length === 0) return null;
  const r = await lireJson<Reglages>(CHEMIN, () => ({ format: FORMAT, theme: THEME_DEFAUT }));
  // Un thème retiré d'une version à l'autre ne doit pas empêcher l'app de s'ouvrir.
  return estTheme(r.theme) ? r : { ...r, theme: THEME_DEFAUT };
}

/**
 * Un profil changé reçoit l'instant présent. La première écriture (écran de bienvenue) reste sans
 * date : une installation neuve n'impose pas ses choix à l'appareil qui a l'historique.
 */
export async function ecrireReglages(r: Reglages): Promise<void> {
  const texte = await stockage.lire(CHEMIN);
  if (texte === null) return ecrireJson(CHEMIN, r);
  // Inchangé : la date du fichier (l'écran tient une copie qui peut ne pas l'avoir).
  const avant: Partial<Reglages> = JSON.parse(texte);
  const le = texteProfil(avant) === texteProfil(r) ? avant.profilModifie : horodatage(new Date());
  await ecrireJson(CHEMIN, { ...r, profilModifie: le });
}
