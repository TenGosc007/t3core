import { styledLabel } from "@/ui/utils/styledLabel";

export const MenuHeader = () => {
  console.log("\t");
  const mainMenuLabel = styledLabel("MAIN MENU", {
    color: "red",
    textStyle: "bold",
  });
  const border = styledLabel("================", {
    color: "yellow",
    textStyle: "dim",
  });
  console.log(`${border} ${mainMenuLabel} ${border}`);
  console.log("\t");
};
