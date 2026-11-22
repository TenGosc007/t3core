/** Shared action outcomes and serializable session errors. */
import type { FinishedGameStatus } from "@/game/contracts";

/** Serializable AI failure exposed in action results and error-phase snapshots. */
export type EngineError = {
  /** Initialization, calculation, illegal-answer or provider-owned timeout category. */
  readonly code:
    | "ai_initialization_failed"
    | "ai_failed"
    | "illegal_ai_move"
    | "ai_timeout";
  /** Human-readable failure description. */
  readonly message: string;
};

/** Expected action refusal; it does not put the session into the error phase. */
export type RejectionReason =
  | "not_started"
  | "paused"
  | "game_finished"
  | "busy"
  | "illegal_move"
  | "invalid_index"
  | "already_selected"
  | "no_history"
  | "session_error"
  | "disposed";

/** Completed action; value is undefined except for the terminal result from run(). */
export type ActionSuccess<T = void> = {
  readonly status: "success";
  /** Action-specific success payload. */
  readonly value: T;
};

/** Expected refusal without applying the requested move or entering the AI error phase. */
export type ActionRejected<Reason extends RejectionReason> = {
  readonly status: "rejected";
  /** Machine-readable reason for refusing the action. */
  readonly reason: Reason;
};

/** Superseded operation; render the current snapshot instead of using an old result. */
export type ActionAborted = { readonly status: "aborted" };

/** Active AI failure; the snapshot also exposes the error and blocks further play. */
export type ActionError = {
  readonly status: "error";
  /** Serializable failure from the active AI operation. */
  readonly error: EngineError;
};

/**
 * Discriminated action outcome: success, rejected, aborted or error.
 * Narrow status before reading value, reason or error. AI failures are data;
 * invalid construction and application callback exceptions still throw.
 * @typeParam T - Success payload; void except for run()'s terminal result.
 * @typeParam Reason - Refusals permitted by the particular action.
 */
export type ActionResult<
  T = void,
  Reason extends RejectionReason = RejectionReason,
> = ActionSuccess<T> | ActionRejected<Reason> | ActionAborted | ActionError;

/** Start/resume outcome; success carries undefined and may include an AI opening. */
export type StartResult = ActionResult<
  void,
  "busy" | "session_error" | "disposed"
>;

/** Human move outcome, including the awaited AI reply in singleplayer. */
export type PlayMoveResult = ActionResult<
  void,
  | "not_started"
  | "paused"
  | "game_finished"
  | "busy"
  | "illegal_move"
  | "invalid_index"
  | "already_selected"
  | "session_error"
  | "disposed"
>;

/** One AI move outcome; stepping a finished game is rejected. */
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

/** Synchronous undo outcome; no_history refuses without cancelling pending work. */
export type UndoResult =
  | ActionSuccess
  | ActionRejected<"no_history" | "disposed">
  | ActionAborted;

/** Internal completion of an operation that has already passed its guards. */
export type OperationResult = ActionSuccess | ActionAborted | ActionError;
