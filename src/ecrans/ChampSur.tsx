import { useState } from "react";
import { t } from "../i18n";

/**
 * Champ en kg enregistré à la sortie (1RM, poids de corps). Une valeur douteuse n'est pas écrite :
 * un bouton « Sûr ? … » apparaît sous le champ et l'écrit au toucher.
 */
export default function ChampSur({ defaut, placeholder, douteux, onValeur }: {
  defaut?: number; placeholder?: string; douteux: (kg: number) => boolean; onValeur: (texte: string) => void;
}) {
  const [doute, setDoute] = useState<string | null>(null);
  const sortir = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (v.trim() && Number.isFinite(n) && douteux(n)) return setDoute(v);
    setDoute(null);
    onValeur(v);
  };
  return (
    <>
      <input type="number" inputMode="decimal" defaultValue={defaut ?? ""} placeholder={placeholder}
             onBlur={(ev) => sortir(ev.target.value)} />
      {doute !== null && (
        <button className="sur" onClick={() => { setDoute(null); onValeur(doute); }}>{t.seance.sur(`${doute} kg`)}</button>
      )}
    </>
  );
}
