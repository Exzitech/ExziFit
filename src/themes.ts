/**
 * Thèmes prêts ; leurs couleurs sont dans theme.css (`[data-theme=…]`), leurs noms dans `t.themes`.
 * Le premier est le défaut.
 */
export const THEMES = [{ id: "braise" }, { id: "nuit" }, { id: "foret" }, { id: "craie" }] as const;

export type IdTheme = (typeof THEMES)[number]["id"];

export const THEME_DEFAUT: IdTheme = THEMES[0].id;

export function estTheme(id: unknown): id is IdTheme {
  return THEMES.some((t) => t.id === id);
}

export function appliquerTheme(id: IdTheme): void {
  document.documentElement.dataset.theme = id;
}
