import {
  cancel, createChannel, Importance, isPermissionGranted, requestPermission, Schedule, sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { dansTauri } from "./stockage";

// Les commandes de canal, de programmation et d'annulation du plugin n'existent que sur mobile :
// sur le PC (navigateur ou `tauri dev`), le repos n'est qu'un compte à rebours.
const surAndroid = dansTauri && /Android/i.test(navigator.userAgent);
const CANAL = "repos";
const ID_NOTIF = 1;
let pret = false;

async function preparer(): Promise<void> {
  if (pret) return;
  if (!(await isPermissionGranted()) && (await requestPermission()) !== "granted") {
    throw new Error("permission de notification refusée : le minuteur ne pourra pas vibrer");
  }
  await createChannel({ id: CANAL, name: "Fin du repos", importance: Importance.High, vibration: true });
  pret = true;
}

/**
 * Lance un repos et renvoie l'instant de fin (ms). La notification programmée (alarme exacte,
 * voir le manifeste Android) est ce qui vibre écran verrouillé ; le compte affiché n'est qu'un repère,
 * dans l'app et dans le volet (décompte muet de ReposPlugin.kt, qui s'efface à la fin).
 * Un nouveau repos remplace le précédent (mêmes identifiants de notification).
 */
export async function lancerRepos(secondes: number): Promise<number> {
  const fin = Date.now() + secondes * 1000;
  if (!surAndroid) return fin;
  await preparer();
  sendNotification({
    id: ID_NOTIF, channelId: CANAL, title: "Repos terminé", body: "Série suivante",
    schedule: Schedule.at(new Date(fin), false, true),
  });
  await invoke("repos_afficher", { fin });
  return fin;
}

/** Annule le repos programmé (fin de séance) : rien ne doit vibrer après. */
export async function annulerRepos(): Promise<void> {
  if (!surAndroid) return;
  await cancel([ID_NOTIF]);
  await invoke("repos_retirer");
}

/** Secondes restantes jusqu'à `fin` (ms), rafraîchies à l'écran ; 0 sans repos en cours. */
export function useReste(fin: number): number {
  const [reste, setReste] = useState(0);
  useEffect(() => {
    if (!fin) return setReste(0);
    const maj = () => setReste(Math.max(0, Math.ceil((fin - Date.now()) / 1000)));
    maj();
    const t = setInterval(maj, 250);
    return () => clearInterval(t);
  }, [fin]);
  return reste;
}
