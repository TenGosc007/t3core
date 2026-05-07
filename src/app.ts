import { navigateTo } from "./ui/navigation";
import { ROUTES } from "./ui/navigation/routes";

export const app = () => {
  navigateTo(ROUTES.MENU);
};
