import { Game } from "@/game/Game";

export function createGameWonByO(): Game {
  const game = new Game();
  // O wins: 0,1,2
  game.savePlayerMove(0); // O
  game.savePlayerMove(3); // X
  game.savePlayerMove(1); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(2); // O — win
  return game;
}
