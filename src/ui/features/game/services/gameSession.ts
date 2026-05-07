import { Game } from "@/core/Game";

let game: Game | null = null;

const createNewGame = () => {
  return new Game();
};

export const getGame = () => {
  if (!game) {
    game = createNewGame();
  }
  return game;
};

export const resetGame = () => {
  getGame().reset();
};
