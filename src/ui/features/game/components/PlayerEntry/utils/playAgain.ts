import { UserInput } from "@/ui/components/UserInput";
import { resetGame } from "@/ui/features/game/services/gameSession";

export const playAgain = async () => {
  console.log(`\t`);
  await UserInput("Press enter to play again ");
  resetGame();
};
