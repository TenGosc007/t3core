import { Header } from "../components/Header";
import { MenuEntry } from "../features/menu/components/MenuEntry";
import { MenuHeader } from "../features/menu/components/MenuHeader";
import { MenuOptions } from "../features/menu/components/MenuOptions";
import { beepAndClear } from "../utils/beepAndClear";

export const MenuScreen = async () => {
  beepAndClear();
  Header();
  MenuHeader();
  MenuOptions();
  MenuEntry();
};
