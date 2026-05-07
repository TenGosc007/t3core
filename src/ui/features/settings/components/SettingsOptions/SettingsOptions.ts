import { getSettings } from "@/ui/global/settings.global";
import { styledLabel } from "@/ui/utils/styledLabel";

import { SETTINGS_OPTIONS } from "../../constants/settingsOptions";

export const SettingsOptions = () => {
  const settings = getSettings();

  SETTINGS_OPTIONS.forEach((item) => {
    const itemNumber = styledLabel(item.id, {
      color: "lightYellow",
      textStyle: "bold",
    });
    const itemLabel = styledLabel(item.label, {
      color: "lightMagenta",
    });

    const setting = settings[item.key];

    const value = setting
      ? styledLabel("ON", { color: "lightGreen" })
      : styledLabel("OFF", { color: "lightRed" });

    const itemValue = value ? ` - ${value}` : "";

    console.log(`[${itemNumber}] ${itemLabel}${itemValue}`);
  });

  const resetToDefault = `[${styledLabel(
    (SETTINGS_OPTIONS.length + 1).toString(),
    {
      color: "lightYellow",
      textStyle: "bold",
    },
  )}] ${styledLabel("Reset to default", {
    color: "grey",
  })}`;

  console.log("\t");
  console.log(resetToDefault);
  console.log("\t");
};
