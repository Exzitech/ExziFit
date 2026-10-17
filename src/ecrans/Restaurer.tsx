import { useRef, useState } from "react";
import { jourLocal, resumerExport } from "../donnees/fichier";
import { t } from "../i18n";
import { stockage } from "../stockage";

const deux = (n: number) => String(n).padStart(2, "0");

/** « Restaurer un export » : choix du fichier, résumé, confirmation, puis relance de l'app sur les données importées. */
export default function Restaurer({ remplace, onErreur }: { remplace: boolean; onErreur: (e: unknown) => void }) {
  const champ = useRef<HTMLInputElement>(null);
  const [choisi, setChoisi] = useState<{ texte: string; resume: ReturnType<typeof resumerExport> } | null>(null);

  const lire = async (f: File | undefined) => {
    if (!f) return;
    try {
      const texte = await f.text();
      setChoisi({ texte, resume: resumerExport(texte) });
    } catch (e) {
      onErreur(e);
    } finally {
      if (champ.current) champ.current.value = "";
    }
  };

  const confirmer = async () => {
    const d = new Date();
    try {
      await stockage.importer(choisi!.texte, `${jourLocal(d)}-${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}`);
      location.reload();
    } catch (e) {
      onErreur(e);
    }
  };

  if (!choisi) {
    return (
      <>
        <button onClick={() => champ.current?.click()}>{t.restaurer.bouton}</button>
        <input ref={champ} type="file" hidden onChange={(ev) => lire(ev.target.files?.[0])} />
      </>
    );
  }
  const { jour, seances, prenom } = choisi.resume;
  return (
    <div className="carte">
      <p>{t.restaurer.resume(jour, prenom, seances)}</p>
      {remplace && <p className="alerte petit">{t.restaurer.remplace}</p>}
      <button className="principal" onClick={confirmer}>{remplace ? t.restaurer.remplacer : t.restaurer.restaurer}</button>
      <button onClick={() => setChoisi(null)}>{t.commun.annuler}</button>
    </div>
  );
}
