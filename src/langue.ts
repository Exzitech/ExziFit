import { traduireExercices } from "./donnees/exercices";
import { traduireProgrammes } from "./donnees/programme";
import { poserLangue, type Langue } from "./i18n";

/** Textes de l'interface, noms d'exercices et textes des programmes du code dans la langue `l`. */
export function appliquerLangue(l: Langue): void {
  poserLangue(l);
  traduireExercices();
  traduireProgrammes();
}
