import { styledLabel } from "@/ui/utils/styledLabel";

export const GameHeader = () => {
  console.log("\t");
  const mainMenuLabel = styledLabel("GAME", {
    color: "red",
    textStyle: "bold",
  });
  const border = styledLabel("===================", {
    color: "green",
    textStyle: "dim",
  });
  console.log(`${border} ${mainMenuLabel} ${border}`);
};
