import { expect, test, vi } from "vitest";

import { AIPlayer } from "../../ai/AIPlayer";
import { AIDifficulty } from "../../ai/types";
import { Game } from "../../game/Game";
import { GameEvent } from "../../game/types/Game.types";

test("nextMove applies a move and returns success", () => {
  const game = new Game();
  // O moves first by default. Let AI be "O" and move on an empty board.
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
  });
  const before = game.movesCount;
  const result = ai.nextMove(game);
  expect(result.status).toBe("success");
  expect(game.movesCount).toBe(before + 1);
});

test("nextMove returns no_moves when the game is not running", () => {
  const game = new Game();
  // O wins: 0,1,2
  game.savePlayerMove(0); // O
  game.savePlayerMove(3); // X
  game.savePlayerMove(1); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(2); // O — win
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  const result = ai.nextMove(game);
  expect(result.status).toBe("no_moves");
});

test("attach auto-plays when it is the AI's turn on attach", () => {
  const game = new Game();
  // AI is "O" (moves first). On attach, it should move immediately.
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
  });
  const listener = vi.fn();
  game.on(GameEvent.STATE_CHANGE, listener);

  ai.attach(game);
  // AI moved immediately → one move on the board, one STATE_CHANGE fired.
  expect(game.movesCount).toBe(1);
  expect(listener).toHaveBeenCalledOnce();
  ai.detach();
});

test("attach does not move when it is not the AI's turn", () => {
  const game = new Game();
  // AI is "X" (moves second). On attach, it's O's turn → AI should not move.
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  ai.attach(game);
  expect(game.movesCount).toBe(0);
  ai.detach();
});

test("attach auto-plays after the opponent moves (STATE_CHANGE triggers the AI)", () => {
  const game = new Game();
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  ai.attach(game);
  expect(game.movesCount).toBe(0); // not AI's turn

  // Human plays O at index 0 → STATE_CHANGE → AI's turn → AI moves.
  game.savePlayerMove(0); // O
  expect(game.movesCount).toBe(2); // O's move + AI's move
  ai.detach();
});

test("detach stops auto-play", () => {
  const game = new Game();
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  ai.attach(game);
  ai.detach();

  // After detach, a human move should NOT trigger the AI.
  game.savePlayerMove(0); // O
  expect(game.movesCount).toBe(1); // only the human move
});

test("detach is a no-op when not attached", () => {
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  expect(() => ai.detach()).not.toThrow();
});

test("attach throws when already attached", () => {
  const game = new Game();
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  ai.attach(game);
  expect(() => ai.attach(game)).toThrow();
  ai.detach();
});

test("setDifficulty changes the level for subsequent moves", () => {
  const ai = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
  });
  expect(ai.difficulty).toBe(AIDifficulty.HARD);
  ai.setDifficulty(AIDifficulty.NORMAL);
  expect(ai.difficulty).toBe(AIDifficulty.NORMAL);
});

test("AI vs AI on HARD terminates and ends in draw or win", () => {
  // Two AIs playing each other on HARD. With the 10% mistake rate on both
  // sides, the game can end in a draw or a win for one side — but it MUST
  // terminate (no infinite loop) and the board must be consistent.
  const game = new Game();
  const aiO = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
    seed: 12345,
  });
  const aiX = new AIPlayer({
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
    seed: 67890,
  });

  aiO.attach(game);
  aiX.attach(game);

  // The game must reach a terminal state.
  expect(["win", "draw"]).toContain(game.gameStatus.status);
  expect(game.movesCount).toBeGreaterThan(0);
  expect(game.movesCount).toBeLessThanOrEqual(9);

  aiO.detach();
  aiX.detach();
});

test("default difficulty is HARD", () => {
  const ai = new AIPlayer({ symbol: "X", opponentSymbol: "O" });
  expect(ai.difficulty).toBe(AIDifficulty.HARD);
});

test("default symbol is X", () => {
  const ai = new AIPlayer();
  expect(ai.symbol).toBe("X");
});
