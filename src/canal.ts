/** Canal de compilation, posé par vite.config.ts depuis EXZIFIT_CANAL (README, « Dev et prod »). */
declare const __CANAL__: "dev" | "potes" | "prod";

/**
 * Envoi des sauvegardes et synchro sur le Nextcloud de Tom : canal dev seulement. Ni l'app des
 * potes ni la version Google Play (prod) n'ont ces commandes.
 */
export const nextcloud = __CANAL__ === "dev";

/** Mise à jour par Nextcloud : dev et potes. La prod ne se met à jour que par le Play Store. */
export const majNextcloud = __CANAL__ !== "prod";
