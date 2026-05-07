import { closeInput, UserInput } from "@/ui/components/UserInput";
import { goToMenu, navigateTo } from "@/ui/navigation";
import { ROUTES } from "@/ui/navigation/routes";
import { beepSound } from "@/ui/utils/beepSound";

export const MenuEntry = async () => {
  console.log("\t");
  const answer = await UserInput("Enter your choice (1-3): ");
  if (answer === "1") {
    navigateTo(ROUTES.GAME);
  } else if (answer === "2") {
    navigateTo(ROUTES.SETTINGS);
  } else if (answer === "3") {
    closeInput();
    beepSound();
    console.log("Exiting the app");
    process.exit(0);
  } else {
    goToMenu();
  }
};
