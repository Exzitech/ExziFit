import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { t } from "./i18n";
import { dansTauri } from "./stockage";

/** Seul l'APK se met à jour depuis Nextcloud (src-tauri/src/maj.rs) ; ni le PC ni le navigateur. */
export const surAndroid = dansTauri && /Android/i.test(navigator.userAgent);

interface Progression { recu: number; total: number | null }

/**
 * Bandeau « ExziFit vX disponible » : version vérifiée au lancement, Installer ouvre
 * l'installeur d'Android. Sans réseau (salle en sous-sol), la vérification échoue sans
 * bandeau et sera refaite au prochain lancement ; seul un échec d'installation s'affiche.
 */
export default function MiseAJour() {
  const [version, setVersion] = useState<string | null>(null);
  const [etat, setEtat] = useState<"attente" | "telechargement" | "erreur">("attente");
  const [erreur, setErreur] = useState("");
  const [progression, setProgression] = useState<Progression | null>(null);

  useEffect(() => {
    const verifier = () =>
      invoke<{ version: string } | null>("maj_verifier")
        .then((d) => setVersion(d?.version ?? null))
        .catch((e) => console.warn("Vérification de mise à jour impossible :", e));
    verifier();
    // Android reprend souvent l'app restée en mémoire au lieu de la relancer : on revérifie au retour.
    const auRetour = () => { if (document.visibilityState === "visible") verifier(); };
    document.addEventListener("visibilitychange", auRetour);
    const arret = listen<Progression>("maj", (e) => setProgression(e.payload));
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      void arret.then((f) => f());
    };
  }, []);

  if (!version) return null;

  const mo = (n: number) => (n / 1024 / 1024).toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const avancement = !progression ? "" : progression.total
    ? ` ${t.pct(String(Math.round((progression.recu * 100) / progression.total)))}`
    : ` ${t.maj.mo(mo(progression.recu))}`;
  const installer = async () => {
    setEtat("telechargement");
    setProgression(null);
    try {
      await invoke("maj_installer");
      setEtat("attente");
    } catch (e) {
      setErreur(String(e));
      setEtat("erreur");
    }
  };

  return (
    <div className="maj">
      <p className={etat === "erreur" ? "alerte" : undefined}>
        {etat === "erreur" ? t.maj.echec(erreur) : t.maj.dispo(version)}
      </p>
      <button className="principal" disabled={etat === "telechargement"} onClick={installer}>
        {etat === "telechargement" ? t.maj.telechargement(avancement) : etat === "erreur" ? t.maj.reessayer : t.maj.installer}
      </button>
    </div>
  );
}
