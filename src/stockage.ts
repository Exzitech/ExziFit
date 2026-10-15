import { invoke } from "@tauri-apps/api/core";

/** Accès brut au dossier de données ; chemins relatifs en `/` (voir src-tauri/src/fichiers.rs). */
export interface Stockage {
  /** `null` si le fichier n'existe pas. */
  lire(chemin: string): Promise<string | null>;
  /** Écriture atomique. */
  ecrire(chemin: string, texte: string): Promise<void>;
  lister(dossier: string): Promise<string[]>;
  supprimer(chemin: string): Promise<void>;
  /** Copie du jour dans `sauvegardes/` ; renvoie le dossier créé, `null` si déjà faite ou rien à copier. */
  sauvegardeDuJour(jour: string): Promise<string | null>;
  /** Envoie la dernière copie sur Nextcloud si elle a changé ; renvoie son jour, `null` si rien à faire ou hors réseau. */
  envoyerSauvegarde(): Promise<string | null>;
  /** Jour de la dernière copie envoyée sur Nextcloud. */
  sauvegardeEnvoyee(): Promise<string | null>;
  dossier(): Promise<string>;
  /** Toutes les données en un fichier JSON (format du paquet envoyé), proposé au partage ; renvoie son nom ou chemin. */
  exporter(jour: string): Promise<string>;
  /** Remplace toutes les données par un export ; copie d'abord les actuelles, renvoie où (`null` si rien à copier). */
  importer(texte: string, etiquette: string): Promise<string | null>;
}

export const dansTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const tauri: Stockage = {
  lire: (chemin) => invoke("lire", { chemin }),
  ecrire: (chemin, texte) => invoke("ecrire", { chemin, texte }),
  lister: (dossier) => invoke("lister", { dossier }),
  supprimer: (chemin) => invoke("supprimer", { chemin }),
  sauvegardeDuJour: (jour) => invoke("sauvegarde_du_jour", { jour }),
  envoyerSauvegarde: () => invoke("sauvegarde_envoyer"),
  sauvegardeEnvoyee: () => invoke("sauvegarde_envoyee"),
  dossier: () => invoke("dossier_donnees"),
  exporter: (jour) => invoke("exporter", { jour }),
  importer: (texte, etiquette) => invoke("importer", { texte, etiquette }),
};

// `npm run dev` dans le navigateur du PC : même interface sur localStorage, pour travailler
// l'interface sans téléphone. Données de test uniquement, sans sauvegarde.
const PREFIXE = "exzifit/";
const navigateur: Stockage = {
  lire: async (chemin) => localStorage.getItem(PREFIXE + chemin),
  ecrire: async (chemin, texte) => localStorage.setItem(PREFIXE + chemin, texte),
  lister: async (dossier) => {
    const debut = PREFIXE + dossier + "/";
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(debut) && !k.slice(debut.length).includes("/"))
      .map((k) => k.slice(debut.length))
      .sort();
  },
  supprimer: async (chemin) => localStorage.removeItem(PREFIXE + chemin),
  sauvegardeDuJour: async () => null,
  envoyerSauvegarde: async () => null,
  sauvegardeEnvoyee: async () => null,
  dossier: async () => "localStorage du navigateur (développement)",
  exporter: async (jour) => {
    const fichiers = Object.fromEntries(
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIXE)).sort().map((k) => [k.slice(PREFIXE.length), localStorage.getItem(k)]),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 1, jour, fichiers }, null, 2)], { type: "application/json" }));
    a.download = `exzifit-${jour}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return a.download;
  },
  // Sans copie préalable : données de test. Le contrôle complet du paquet est côté Rust.
  importer: async (texte) => {
    const { fichiers } = JSON.parse(texte) as { fichiers: Record<string, string> };
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIXE)).forEach((k) => localStorage.removeItem(k));
    for (const [chemin, contenu] of Object.entries(fichiers)) localStorage.setItem(PREFIXE + chemin, contenu);
    return null;
  },
};

export const stockage: Stockage = dansTauri ? tauri : navigateur;
