import type { PlayerSymbol } from "@/core";

import { getGame } from "@/ui/features/game/services/gameSession";
import { colorLabelSymbol } from "@/ui/features/game/util/colorLabelSymbol";
import { styledLabel } from "@/ui/utils/styledLabel";

const borderStyle = { color: "grey", textStyle: "bold" } as const;

export const Board = () => {
  const game = getGame();
  const fields = game.getBoard();

  const border = styledLabel("-------------", borderStyle);
  const fieldBorder = styledLabel("|", borderStyle);

  console.log(border);
  fields.forEach((i: number | PlayerSymbol, idx: number) => {
    if (idx % 3 === 0) {
      console.log(
        `${fieldBorder} ${colorLabelSymbol(
          i,
        )} ${fieldBorder} ${colorLabelSymbol(
          fields[idx + 1],
        )} ${fieldBorder} ${colorLabelSymbol(fields[idx + 2])} ${fieldBorder}`,
      );
      console.log(border);
    }
  });
};
