import { styledLabel } from "@/ui/utils/styledLabel";

const borderStyle = { color: "red" } as const;

export const Header = () => {
  console.log(`\t`);
  const gameName = styledLabel("Tic Tac Toe Game", {
    color: "yellow",
    textStyle: "bold",
  });
  const border = styledLabel(
    "============================================",
    borderStyle
  );
  const sideBorder = styledLabel("|", borderStyle);

  const headerLabel = styledLabel(
    `${border} 
${sideBorder}             ${gameName}             ${sideBorder} 
${border}`
  );
  console.log(headerLabel);
  console.log("\t");
};
