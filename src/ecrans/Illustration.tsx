import { illustration, type Style } from "../donnees/illustrations";

/** Dessin : masque coloré par le thème (`--texte`) ; photo : telle quelle. */
function Image({ src, style, className }: { src: string; style: Style; className?: string }) {
  if (style === "photo") return <img className={`${className ?? ""} photo`} src={src} alt="" loading="lazy" />;
  return <span className={`${className ?? ""} trait`} style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />;
}

/**
 * Image d'un exo : `vignette` = la position de fin seule, en tête de ligne ; `grande` = départ et fin
 * côte à côte (pli « Technique »). Rien si l'exo n'a pas d'image.
 */
export default function Illustration({ id, taille }: { id: string; taille: "vignette" | "grande" }) {
  const il = illustration(id);
  if (taille === "vignette") {
    return il ? <Image className="vignette" src={il.fin} style={il.style} /> : <span className="vignette" aria-hidden="true" />;
  }
  if (!il) return null;
  return (
    <div className="illustration" aria-hidden="true">
      <Image src={il.depart} style={il.style} />
      <Image src={il.fin} style={il.style} />
    </div>
  );
}
