export const ROUTES = {
  MENU: "menu",
  GAME: "game",
  SETTINGS: "settings",
} as const;
export type Routes = (typeof ROUTES)[keyof typeof ROUTES];
