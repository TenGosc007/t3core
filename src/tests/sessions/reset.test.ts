import type { GameSessionEventType, MoveStrategy } from "@/index";

import { expect, test } from "vitest";

import {
  AIGame,
  Game,
  GameEvent,
  MoveStrategyError,
  PvPGame,
  SinglePlayerGame,
} from "@/index";

for (const event of ["move", "turn", "finished"] as const) {
  test(`PvP aborts when a ${event} listener resets the session`, async () => {
    const game = new Game();
    const session = new PvPGame({ game });
    await session.start();
    if (event === "finished") {
      for (const move of [0, 3, 1, 4]) await session.playMove(move);
    }
    const events: string[] = [];
    for (const type of ["move", "turn", "finished"] as const) {
      session.on(type, () => events.push(type));
    }
    const reset = () => session.reset();
    session.on(event, reset);

    expect(await session.playMove(2)).toEqual({ status: "aborted" });
    expect(events[events.length - 1]).toBe(event);
    expect(session.movesCount).toBe(0);
    session.off(event, reset);
    expect(await session.start()).toEqual({ status: "success" });
  });
}

test("reset in a human move listener prevents AI computation", async () => {
  let calls = 0;
  const session = new SinglePlayerGame({
    game: new Game(),
    humanSymbol: "O",
    aiSymbol: "X",
    strategy: {
      calculateMove: async () => {
        calls++;
        return 4;
      },
    },
  });
  await session.start();
  const events: string[] = [];
  session.on("ai-thinking", () => events.push("ai-thinking"));
  session.on("move", () => session.reset());

  expect(await session.playMove(0)).toEqual({ status: "aborted" });
  expect(calls).toBe(0);
  expect(events).toEqual([]);
  expect(session.movesCount).toBe(0);
});

const aiEvents: GameSessionEventType[] = [
  "ai-thinking",
  "move",
  "turn",
  "finished",
];

for (const mode of ["singleplayer", "step", "run"] as const) {
  for (const event of aiEvents) {
    test(`${mode} aborts when a ${event} listener resets the session`, async () => {
      const game = new Game();
      if (event === "finished") {
        for (const move of [0, 3, 1, 4]) game.savePlayerMove(move);
      }
      let calls = 0;
      const strategy: MoveStrategy = {
        calculateMove: async (board) => {
          calls++;
          return board.findIndex((field) => typeof field !== "string");
        },
      };
      const session =
        mode === "singleplayer"
          ? new SinglePlayerGame({
              game,
              strategy,
              humanSymbol: "X",
              aiSymbol: "O",
            })
          : new AIGame({ game, strategies: [strategy, strategy] });
      const events: string[] = [];
      for (const type of aiEvents) {
        session.on(type, () => events.push(type));
      }
      session.on(event, () => session.reset());

      const result =
        session instanceof SinglePlayerGame
          ? await session.start()
          : mode === "step"
            ? await session.step()
            : await session.run();

      expect(result).toEqual({ status: "aborted" });
      expect(events[events.length - 1]).toBe(event);
      expect(calls).toBe(event === "ai-thinking" ? 0 : 1);
      expect(session.movesCount).toBe(0);
      expect(session.currentPlayer).toBe("O");
    });
  }
}

for (const method of ["step", "run"] as const) {
  test(`AI ${method} propagates no_legal_moves without retrying or finishing`, async () => {
    let calls = 0;
    const error = new MoveStrategyError("no_legal_moves", "test");
    const strategy: MoveStrategy = {
      calculateMove: async () => {
        if (++calls > 1) throw new Error("Unexpected retry");
        throw error;
      },
    };
    const session = new AIGame({
      game: new Game(),
      strategies: [strategy, strategy],
    });
    let finished = false;
    session.on("finished", () => {
      finished = true;
    });

    await expect(session[method]()).rejects.toBe(error);
    expect(calls).toBe(1);
    expect(finished).toBe(false);
    expect(session.gameStatus.status).toBe("running");
  });
}

for (const mode of ["pvp", "singleplayer", "aivsai"] as const) {
  test(`${mode} aborts if the underlying Game listener resets during a move`, async () => {
    const game = new Game();
    const strategy: MoveStrategy = { calculateMove: async () => 0 };
    const session =
      mode === "pvp"
        ? new PvPGame({ game })
        : mode === "singleplayer"
          ? new SinglePlayerGame({
              game,
              strategy,
              humanSymbol: "O",
              aiSymbol: "X",
            })
          : new AIGame({ game, strategies: [strategy, strategy] });
    if (!(session instanceof AIGame)) await session.start();
    const events: string[] = [];
    session.on("move", () => events.push("move"));
    session.on("ai-thinking", () => events.push("ai-thinking"));
    const reset = () => {
      game.off(GameEvent.STATE_CHANGE, reset);
      session.reset();
    };
    game.on(GameEvent.STATE_CHANGE, reset);

    const result =
      session instanceof AIGame
        ? await session.step()
        : await session.playMove(0);

    expect(result).toEqual({ status: "aborted" });
    expect(events).toEqual(mode === "aivsai" ? ["ai-thinking"] : []);
    expect(session.movesCount).toBe(0);
  });
}

for (const mode of ["singleplayer", "aivsai"] as const) {
  test(`${mode} prioritizes reset when a stale strategy rejects`, async () => {
    const strategy: MoveStrategy = {
      calculateMove: async () => {
        session.reset();
        throw new MoveStrategyError("no_legal_moves", "stale computation");
      },
    };
    const game = new Game();
    const session =
      mode === "singleplayer"
        ? new SinglePlayerGame({
            game,
            strategy,
            humanSymbol: "X",
            aiSymbol: "O",
          })
        : new AIGame({ game, strategies: [strategy, strategy] });

    const result =
      session instanceof AIGame ? await session.run() : await session.start();

    expect(result).toEqual({ status: "aborted" });
    expect(session.movesCount).toBe(0);
  });
}
