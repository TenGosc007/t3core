import { getGame } from "@/ui/features/game/services/gameSession";
import { colorLabelSymbol } from "@/ui/features/game/util/colorLabelSymbol";
import { styledLabel } from "@/ui/utils/styledLabel";

import { getPlayerAnswer } from "./utils/getPlayerAnswer";
import { playAgain } from "./utils/playAgain";

export const PlayerEntry = async (callback: () => void) => {
  const game = getGame();

  if (game.gameStatus.status !== "running") {
    await playAgain();
    callback();
    return;
  }

  console.log(`\t`);
  console.log(
    `${styledLabel("Player:", { textStyle: "underline", color: "white" })} (${colorLabelSymbol(game.currentPlayer)})`,
  );
  console.log(`\t`);
  console.log(
    `${styledLabel("Select the number of the field (1-9)", { color: "white" })}`,
  );
  console.log(
    `${styledLabel('Press "q" to back to the main menu', { textStyle: "dim" })}`,
  );
  console.log(`\t`);

  const answer = await getPlayerAnswer();
  if (answer == null) return;

  game.savePlayerSelection(answer);
  callback();
};
