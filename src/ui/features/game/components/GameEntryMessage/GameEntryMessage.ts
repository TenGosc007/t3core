import { styledLabel } from "@/ui/utils/styledLabel";

export const GameEntryMessage = () => {
  const border = styledLabel("--------------------------------------------", {
    color: "yellow",
  });

  console.log(border);
  const gameEntryMessage = styledLabel(
    `Tic-tac-toe is a simple two-player game 
played on a 3×3 grid. Players take turns 
marking a square with X or O, trying to get 
three in a row horizontally, vertically, 
or diagonally. 

The game ends when one player wins or all 
squares are filled, resulting in a draw.`,
    { textStyle: "italic", color: "grey" },
  );
  console.log(gameEntryMessage);
  console.log(border);
  console.log(`\t`);
};
