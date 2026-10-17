/** Canal de compilation, posé par vite.config.ts depuis EXZIFIT_CANAL (README, « Dev et prod »). */
declare const __CANAL__: "dev" | "prod";

/**
 * Mise à jour par Nextcloud, envoi des sauvegardes et synchro : canal dev seulement. La version
 * Google Play (prod) ne se met à jour que par le Play Store, et ces commandes n'y existent pas.
 */
export const nextcloud = __CANAL__ === "dev";
