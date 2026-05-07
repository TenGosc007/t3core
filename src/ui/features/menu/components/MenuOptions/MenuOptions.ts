import { styledLabel } from "@/ui/utils/styledLabel";

import { MENU_ITEMS } from "../../constants/menuItems";

export const MenuOptions = () => {
  MENU_ITEMS.forEach((item) => {
    const itemNumber = styledLabel(item.id, {
      color: "lightYellow",
      textStyle: "bold",
    });
    const itemLabel = styledLabel(item.label, {
      color: "lightBlue",
    });

    console.log(`[${itemNumber}] ${itemLabel}`);
  });
};
