import { styledLabel } from "@/ui/utils/styledLabel";

export const SettingsHeader = () => {
  console.log("\t");
  const mainMenuLabel = styledLabel("SETTINGS", {
    color: "red",
    textStyle: "bold",
  });
  const border = styledLabel("=================", {
    color: "magenta",
    textStyle: "dim",
  });
  console.log(`${border} ${mainMenuLabel} ${border}`);
  console.log("\t");
};
