import { useEffect, useRef } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import type { PluginListener } from "@tauri-apps/api/core";
import { surAndroid } from "./MiseAJour";

// La navigation est un état React, sans historique : sans écouteur, le bouton retour d'Android
// ferme l'app. On n'écoute donc que tant qu'une sous-vue est ouverte ; à la racine, l'écoute est
// retirée et Android garde son comportement normal (fermer), sans permission de sortie à ajouter.

/** Actions de retour actives, la dernière ouverte au sommet. */
const pile: Array<() => void> = [];
let ecoute: Promise<PluginListener> | null = null;

function synchroniser(onErreur: (e: unknown) => void) {
  if (pile.length && !ecoute) {
    ecoute = onBackButtonPress(() => pile[pile.length - 1]?.());
    ecoute.catch(onErreur);
  } else if (!pile.length && ecoute) {
    const e = ecoute;
    ecoute = null;
    e.then((l) => l.unregister()).catch(onErreur);
  }
}

/** Le bouton retour d'Android exécute `action` tant qu'elle n'est pas nulle. */
export function useBoutonRetour(action: (() => void) | null, onErreur: (e: unknown) => void) {
  const derniere = useRef(action);
  derniere.current = action;
  const actif = action !== null;
  useEffect(() => {
    if (!actif || !surAndroid) return;
    const entree = () => derniere.current?.();
    pile.push(entree);
    synchroniser(onErreur);
    return () => {
      pile.splice(pile.indexOf(entree), 1);
      synchroniser(onErreur);
    };
  }, [actif]);
}
