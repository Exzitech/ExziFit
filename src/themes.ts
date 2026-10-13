/** Thèmes prêts ; leurs couleurs sont dans theme.css (`[data-theme=…]`). Le premier est le défaut. */
export const THEMES = [
  { id: "braise", nom: "Braise" },
  { id: "nuit", nom: "Nuit" },
  { id: "foret", nom: "Forêt" },
  { id: "craie", nom: "Craie (clair)" },
] as const;

export type IdTheme = (typeof THEMES)[number]["id"];

export const THEME_DEFAUT: IdTheme = THEMES[0].id;

export function estTheme(id: unknown): id is IdTheme {
  return THEMES.some((t) => t.id === id);
}

export function appliquerTheme(id: IdTheme): void {
  document.documentElement.dataset.theme = id;
}
