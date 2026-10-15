import { useRef, useState } from "react";
import { jourLocal, resumerExport } from "../donnees/fichier";
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
        <button onClick={() => champ.current?.click()}>Restaurer un export</button>
        <input ref={champ} type="file" hidden onChange={(ev) => lire(ev.target.files?.[0])} />
      </>
    );
  }
  const { jour, seances, prenom } = choisi.resume;
  return (
    <div className="carte">
      <p>
        Export du {jour}{prenom ? ` (${prenom})` : ""} : {seances} séance{seances > 1 ? "s" : ""}.
      </p>
      {remplace && (
        <p className="alerte petit">Remplace les données de ce téléphone ; une copie en est gardée dans les sauvegardes.</p>
      )}
      <button className="principal" onClick={confirmer}>{remplace ? "Remplacer mes données" : "Restaurer"}</button>
      <button onClick={() => setChoisi(null)}>Annuler</button>
    </div>
  );
}
