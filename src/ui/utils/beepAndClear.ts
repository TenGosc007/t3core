import { beepSound } from "./beepSound";

export const beepAndClear = () => {
  beepSound();
  console.clear();
};
