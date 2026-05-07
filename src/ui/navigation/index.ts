import type { Routes } from "./routes";

import { GameScreen } from "../screens/Game.screen";
import { MenuScreen } from "../screens/Menu.screen";
import { SettingsScreen } from "../screens/Settings.screen";
import { ROUTES } from "./routes";

export const navigateTo = (route: Routes) => {
  switch (route) {
    case ROUTES.MENU:
      MenuScreen();
      break;
    case ROUTES.GAME:
      GameScreen();
      break;
    case ROUTES.SETTINGS:
      SettingsScreen();
      break;

    default:
      throw new Error(`Unknown route: ${route satisfies never}`);
  }
};

export const goToMenu = () => {
  return navigateTo(ROUTES.MENU);
};
