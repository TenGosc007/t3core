/**
 * Type-checked lifecycle scenarios. The injected constructor retains stricter
 * draft configuration; per-mode instance types are shared with the runtime.
 */
import type { TicTacToeConstructor } from "@/facade/contracts/instance";
import type { PlayerSymbol } from "@/game/contracts";
import type { SnapshotFor } from "@/sessions/state/types";

export async function pvpExample(
  TicTacToe: TicTacToeConstructor,
  render: (state: SnapshotFor<"pvp">) => void,
) {
  const game = new TicTacToe({ mode: "pvp", variant: "classic-3x3" });
  const unsubscribe = game.subscribe(() => render(game.getSnapshot()));

  try {
    render(game.getSnapshot());
    const started = await game.start();
    if (started.status !== "success") return started;

    // O wins across the first row. In a UI, clicks supply these indices.
    for (const index of [0, 3, 1, 4, 2]) {
      const moved = await game.playMove(index);
      if (moved.status !== "success") return moved;
    }

    return await game.restart();
  } finally {
    unsubscribe();
    game.dispose();
  }
}

/** Passing X exercises an AI opening before the first human move. */
export async function singlePlayerExample(
  TicTacToe: TicTacToeConstructor,
  render: (state: SnapshotFor<"singleplayer">) => void,
  humanSymbol: PlayerSymbol = "O",
) {
  const game = new TicTacToe({
    mode: "singleplayer",
    variant: "classic-3x3",
    humanSymbol,
    ai: { engine: "alphabeta", difficulty: "hard", seed: 123 },
  });
  const unsubscribe = game.subscribe(() => render(game.getSnapshot()));

  try {
    render(game.getSnapshot());
    const started = await game.start();
    if (started.status !== "success") return started;

    const state = game.getSnapshot();
    const index = state.legalMoves[0];
    if (!state.canPlay || index === undefined) return;

    // Subscribers observe ai-thinking and then the reply or finished state.
    const moved = await game.playMove(index);
    if (moved.status !== "success") return moved;

    return await game.restart();
  } finally {
    unsubscribe();
    game.dispose();
  }
}

export async function aiVsAiExample(
  TicTacToe: TicTacToeConstructor,
  render: (state: SnapshotFor<"aivsai">) => void,
) {
  const game = new TicTacToe({
    mode: "aivsai",
    variant: "classic-3x3",
    aiPlayers: [
      { engine: "alphabeta", difficulty: "hard", seed: 1 },
      { engine: "random", seed: 2 },
    ],
  });
  const unsubscribe = game.subscribe(() => render(game.getSnapshot()));

  try {
    render(game.getSnapshot());
    const stepped = await game.step();
    if (stepped.status !== "success") return stepped;

    const completed = await game.run();
    if (completed.status !== "success") return completed;

    // The result is guaranteed to be a win or draw, never running.
    const result = completed.value;
    const restarted = await game.restart();
    return { result, restarted };
  } finally {
    unsubscribe();
    game.dispose();
  }
}
