import type {
  AivsAiInstance,
  GameEventPayload,
  IGame,
  MoveStrategy,
  PvPInstance,
} from "t3core";

import {
  Game,
  GameEvent,
  PlayerMoveStatus,
  RandomStrategy,
  TicTacToe,
} from "t3core";

async function verifyConsumer() {
  const game: IGame = new Game();
  let observed: GameEventPayload | undefined;
  game.on(GameEvent.STATE_CHANGE, (snapshot) => { observed = snapshot; });
  if (game.savePlayerMove(4) !== PlayerMoveStatus.SUCCESS || observed?.board[4] !== "O") {
    throw new Error("Game exports or typed event callbacks do not work");
  }

  const pvp: PvPInstance = new TicTacToe({ mode: "pvp" });
  await pvp.start();
  const result = await pvp.playMove(4);
  if (result.status !== "success" || pvp.board[4] !== "O") {
    throw new Error("PvP facade does not work");
  }

  const strategy: MoveStrategy = new RandomStrategy({ seed: 1 });
  const index = await strategy.calculateMove(game.board, {
    aiSymbol: "X",
    opponentSymbol: "O",
    gameStatus: game.gameStatus,
  });
  if (typeof game.board[index] !== "number") {
    throw new Error("Strategy did not return a legal move");
  }

  const ai: AivsAiInstance = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [{ engine: "random", seed: 1 }, { engine: "random", seed: 2 }],
  });
  if ((await ai.run()).status !== "completed" || ai.gameStatus.status === "running") {
    throw new Error("AI facade does not finish a game");
  }
}

// These calls must be rejected during type checking, without executing them.
export function checkInvalidCalls() {
  const pvp = new TicTacToe({ mode: "pvp" });
  // @ts-expect-error PvP instances do not expose AI-only methods.
  pvp.step();
  // @ts-expect-error Board indices must be numbers.
  pvp.playMove("4");
  // @ts-expect-error AI-vs-AI requires both AI configurations.
  new TicTacToe({ mode: "aivsai" });
}

void verifyConsumer().catch((error) => { throw error; });
