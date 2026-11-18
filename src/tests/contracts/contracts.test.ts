import type {
  AivsAiInstance,
  PvPInstance,
  SinglePlayerInstance,
  TicTacToeConstructor,
} from "@/facade/contracts/instance";
import type { AIConfig, TicTacToeOptions } from "@/facade/contracts/options";
import type { FinishedGameStatus, PlayerSymbol, VariantId } from "@/game/contracts";
import type {
  ActionResult,
  EngineError,
  PlayMoveResult,
  RestartResult,
  RunResult,
  StartResult,
  StepResult,
  StopResult,
  UndoResult,
} from "@/sessions/contracts/results";
import type { SessionSnapshot, SnapshotFor } from "@/sessions/state/types";

import { expectTypeOf, test } from "vitest";

import { aiVsAiExample, pvpExample, singlePlayerExample } from "./examples";

test("v2 options accept only implemented variants, fixed symbols and engine-specific options", () => {
  expectTypeOf<PlayerSymbol>().toEqualTypeOf<"O" | "X">();
  expectTypeOf<VariantId>().toEqualTypeOf<"classic-3x3">();
  expectTypeOf<{ engine: "random"; seed: 1 }>().toExtend<AIConfig>();
  expectTypeOf<{ engine: "random"; difficulty: "hard" }>().not.toExtend<AIConfig>();
  expectTypeOf<{ mode: "pvp"; ai: { engine: "random" } }>().not.toExtend<TicTacToeOptions>();
  expectTypeOf<{ mode: "aivsai"; aiPlayers: readonly [Record<string, never>, Record<string, never>] }>().toExtend<TicTacToeOptions>();
  expectTypeOf<{ mode: "aivsai"; aiPlayers: readonly [Record<string, never>] }>().not.toExtend<TicTacToeOptions>();
});

test("snapshot narrowing connects phase, result, error and input availability", () => {
  type Finished = Extract<SessionSnapshot, { phase: "finished" }>;
  type Thinking = Extract<SessionSnapshot, { phase: "ai-thinking" }>;
  type Failed = Extract<SessionSnapshot, { phase: "error" }>;
  type Ready = Extract<SessionSnapshot, { phase: "ai-ready" }>;

  expectTypeOf<Finished["gameStatus"]>().toEqualTypeOf<FinishedGameStatus>();
  expectTypeOf<Finished["canPlay"]>().toEqualTypeOf<false>();
  expectTypeOf<Finished["legalMoves"]>().toEqualTypeOf<readonly []>();
  expectTypeOf<Thinking["mode"]>().toEqualTypeOf<"singleplayer" | "aivsai">();
  expectTypeOf<Thinking["canPlay"]>().toEqualTypeOf<false>();
  expectTypeOf<Failed["error"]>().toEqualTypeOf<EngineError>();
  expectTypeOf<Ready["mode"]>().toEqualTypeOf<"aivsai">();
  expectTypeOf<SnapshotFor<"pvp">["humanSymbol"]>().toEqualTypeOf<null>();
  expectTypeOf<Extract<SnapshotFor<"aivsai">, { phase: "human-turn" }>>().toBeNever();
});

test("actions narrow refusals by method and run returns only terminal outcomes", () => {
  type Refusal<Result> = Extract<Result, { status: "rejected" }>;
  expectTypeOf<Refusal<StartResult>["reason"]>().toEqualTypeOf<"busy" | "session_error" | "disposed">();
  expectTypeOf<Refusal<StepResult>["reason"]>().toEqualTypeOf<"busy" | "game_finished" | "session_error" | "disposed">();
  expectTypeOf<Refusal<RestartResult>["reason"]>().toEqualTypeOf<"disposed">();
  expectTypeOf<Refusal<UndoResult>["reason"]>().toEqualTypeOf<"no_history" | "disposed">();
  expectTypeOf<Extract<RunResult, { status: "success" }>["value"]>().toEqualTypeOf<FinishedGameStatus>();
  expectTypeOf<Extract<StopResult | UndoResult, { status: "error" }>>().toBeNever();
  expectTypeOf<PlayMoveResult>().toExtend<ActionResult>();
});

test("mode-specific instances expose the correct actions and synchronous cleanup", () => {
  expectTypeOf<PvPInstance["playMove"]>().returns.toEqualTypeOf<Promise<PlayMoveResult>>();
  expectTypeOf<SinglePlayerInstance["start"]>().returns.toEqualTypeOf<Promise<StartResult>>();
  expectTypeOf<AivsAiInstance["step"]>().returns.toEqualTypeOf<Promise<StepResult>>();
  expectTypeOf<AivsAiInstance["run"]>().returns.toEqualTypeOf<Promise<RunResult>>();
  expectTypeOf<PvPInstance["stop"]>().returns.toEqualTypeOf<StopResult>();
  expectTypeOf<PvPInstance["undo"]>().returns.toEqualTypeOf<UndoResult>();
  expectTypeOf<PvPInstance["dispose"]>().returns.toBeVoid();
});

test("usage scenarios require the proposed constructor instead of executing future API on v1", () => {
  expectTypeOf(pvpExample).parameter(0).toEqualTypeOf<TicTacToeConstructor>();
  expectTypeOf(singlePlayerExample).parameter(0).toEqualTypeOf<TicTacToeConstructor>();
  expectTypeOf(aiVsAiExample).parameter(0).toEqualTypeOf<TicTacToeConstructor>();
});

test("invalid consumer calls and mutation attempts are rejected by tsc", () => {
  // Checked by yarn ts:check; this consumer fixture is intentionally not called.
  const invalidConsumer = (TicTacToe: TicTacToeConstructor, state: SessionSnapshot) => {
    const pvp = new TicTacToe({ mode: "pvp" });
    const ai = new TicTacToe({ mode: "aivsai", aiPlayers: [{}, {}] });
    // @ts-expect-error Human-driven modes do not expose AI stepping.
    pvp.step();
    // @ts-expect-error AI-vs-AI has no human start method.
    ai.start();
    // @ts-expect-error AI-vs-AI has no human input method.
    ai.playMove(0);
    // @ts-expect-error The symbol contract is closed to O and X.
    new TicTacToe({ mode: "singleplayer", humanSymbol: "Y" });
    // @ts-expect-error Future variants are not implemented.
    new TicTacToe({ mode: "pvp", variant: "connect-9x9-5" });
    // @ts-expect-error Random AI does not accept a difficulty setting.
    new TicTacToe({ mode: "singleplayer", ai: { engine: "random", difficulty: "hard" } });
    // @ts-expect-error Board snapshots cannot be mutated.
    state.board[0] = "X";
    // @ts-expect-error Nested status data cannot be mutated.
    state.gameStatus.status = "running";
    // @ts-expect-error Variant metadata cannot be mutated.
    state.variant.rows = 3;
    // @ts-expect-error The game cannot accept a move after finishing.
    const inconsistent: SessionSnapshot = { ...state, phase: "finished", gameStatus: { status: "draw" }, legalMoves: [], canPlay: true, error: null };
    return inconsistent;
  };

  expectTypeOf(invalidConsumer).toBeFunction();
});
