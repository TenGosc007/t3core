/** Draft action results; EngineError is already used by public session state. */
import type { FinishedGameStatus } from "@/game/contracts";

export type EngineError = {
  readonly code:
    | "ai_initialization_failed"
    | "ai_failed"
    | "illegal_ai_move"
    | "ai_timeout";
  readonly message: string;
};

export type RejectionReason =
  | "not_started"
  | "paused"
  | "game_finished"
  | "busy"
  | "invalid_index"
  | "already_selected"
  | "no_history"
  | "session_error"
  | "disposed";

export type ActionSuccess<T = void> = {
  readonly status: "success";
  readonly value: T;
};

export type ActionRejected<Reason extends RejectionReason> = {
  readonly status: "rejected";
  readonly reason: Reason;
};

export type ActionAborted = { readonly status: "aborted" };

export type ActionError = {
  readonly status: "error";
  readonly error: EngineError;
};

/** Shared envelope; method aliases below restrict which refusals are possible. */
export type ActionResult<
  T = void,
  Reason extends RejectionReason = RejectionReason,
> = ActionSuccess<T> | ActionRejected<Reason> | ActionAborted | ActionError;

export type StartResult = ActionResult<
  void,
  "busy" | "session_error" | "disposed"
>;

export type PlayMoveResult = ActionResult<
  void,
  | "not_started"
  | "paused"
  | "game_finished"
  | "busy"
  | "invalid_index"
  | "already_selected"
  | "session_error"
  | "disposed"
>;

export type StepResult = ActionResult<
  void,
  "game_finished" | "busy" | "session_error" | "disposed"
>;

/** Success always contains a terminal result, never a still-running position. */
export type RunResult = ActionResult<
  FinishedGameStatus,
  "busy" | "session_error" | "disposed"
>;

/** Restart cancels existing work instead of refusing it as busy. */
export type RestartResult = ActionResult<void, "disposed">;

/** Synchronous operations may be invalidated by a subscriber, but do not run AI. */
export type StopResult =
  | ActionSuccess
  | ActionRejected<"disposed">
  | ActionAborted;

export type UndoResult =
  | ActionSuccess
  | ActionRejected<"no_history" | "disposed">
  | ActionAborted;
