import type { GameStatus } from "@/core/types/Game";

import { getGame } from "@/ui/features/game/services/gameSession";
import { colorLabelSymbol } from "@/ui/features/game/util/colorLabelSymbol";
import { styledLabel } from "@/ui/utils/styledLabel";

const textStyle = { color: "lightWhite" } as const;

function messageForGameStatus(gameStatus: GameStatus): string | undefined {
  switch (gameStatus.status) {
    case "running":
      return undefined;
    case "draw":
      return styledLabel("The game is a draw 🤝", textStyle).toString();
    case "win":
      return `${styledLabel("Player", textStyle).toString()} ${colorLabelSymbol(
        gameStatus.winner,
      )} ${styledLabel("wins! 🎉", textStyle).toString()}`;

    default:
      throw new Error(`Unknown game status: ${gameStatus satisfies never}`);
  }
}

export const GameStatusMessage = () => {
  const line = messageForGameStatus(getGame().gameStatus);

  if (line === undefined) {
    return;
  }

  console.log("\t");
  console.log(line);
};
