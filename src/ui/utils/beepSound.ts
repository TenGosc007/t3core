import { getSettings } from "../global/settings.global";

export const beepSound = () => {
  if (getSettings().beep) {
    process.stdout.write("\x07");
  }
};
