import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { t } from "./i18n";

/**
 * Bandeau tant que l'alarme exacte n'est pas permise (Android 14 et plus la refuse d'office à
 * l'installation) : sans elle, la vibration de fin de repos peut arriver des minutes en retard.
 * Autoriser ouvre le réglage d'Android ; l'état est relu au retour dans l'app.
 */
export default function AlarmeExacte() {
  const [permise, setPermise] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const verifier = () =>
      invoke<boolean>("alarme_exacte")
        .then(setPermise)
        .catch((e) => console.warn("Alarme exacte : vérification impossible :", e));
    verifier();
    const auRetour = () => { if (document.visibilityState === "visible") verifier(); };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  if (permise) return null;
  return (
    <div className="maj">
      <p className={erreur ? "alerte" : undefined}>{erreur || t.alarme.imprecise}</p>
      <button className="principal" onClick={() => invoke("alarme_exacte_demander").catch((e) => setErreur(String(e)))}>
        {t.alarme.autoriser}
      </button>
    </div>
  );
}
