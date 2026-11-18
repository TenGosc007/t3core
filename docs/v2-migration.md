# V2 migration in progress

This branch contains staged breaking changes intended for v2. It has not changed
the package version or published a release. Stage 2 changes observation; lifecycle
and action results still use the existing contracts.

## Session snapshots

`TicTacToe.snapshot`, direct session `snapshot`, and the new stable, bound
`getSnapshot()` return a full `SessionSnapshot`, rather than the underlying
`GameEventPayload`. Facade instances narrow this to `SnapshotFor<Mode>`.

Existing reads of `board`, `currentPlayer` and `gameStatus` continue to work.
Use `phase === 'ai-thinking'` for progress, `canPlay` for human input, and
`legalMoves` for legal indices. The variant descriptor supplies dimensions and
win length; constructor selection remains the string `classic-3x3`.
Session `movesCount` counts moves in the current position, rather than retained
future history. `canUndo` describes available decision history; the `undo`
method arrives in stage 3.

Snapshots, boards, legal moves, variant metadata, results and errors are frozen.
Repeated reads return the same object until a change. Phase changes preserve
the board and legal-moves references. Retain an old snapshot safely as a value;
do not mutate it.

## Observation and events

Replace an application-owned snapshot wrapper with `game.getSnapshot`.
`subscribe(callback)` remains bound and returns independent, idempotent cleanup
for each registration. It now notifies for phase changes as well as moves/reset:

- Human-driven `start()` publishes `human-turn`, or `ai-thinking` if AI opens.
- A human move publishes its board and `ai-thinking` together; the AI reply
  publishes `human-turn` or `finished`.
- AI-vs-AI `step()` publishes `ai-thinking`, then `ai-ready` or `finished`.
  `run()` stays in `ai-thinking` between moves and publishes `finished` once.
- Current AI failures publish `error` with a plain `{ code, message }`.

Registration does not invoke the callback; perform an initial render explicitly.
There is no one-notification-per-move guarantee. A snapshot is committed before
its subscribers and corresponding session events run. Session event payloads
remain unchanged. Rejected moves and overlapping busy calls do not notify.

Callbacks run synchronously and can unsubscribe or reset. A nested state change
supersedes the remaining notification delivery for the old snapshot. An action
started from a ready-state callback is accepted; it supersedes the old operation's
remaining events and result (`aborted`). Only the owning operation releases its
lock. Reset also invalidates late AI results and rejections.

Application callback exceptions propagate without rollback. If a callback
interrupts an AI turn before completion, the session publishes `paused` instead
of leaving a permanent thinking indicator; use reset/start to recover.
This also applies when a low-level Game callback interrupts a session move.

Direct session constructors may receive a pre-populated `Game`. After session
construction, perform mutations through the session. Mutating the injected
`Game` directly bypasses coherent session publication. `Game.snapshot` and its
`STATE_CHANGE` event remain the separate, unchanged low-level API.

## Still deferred

`start()` still throws when repeated on an active human-driven session.
`reset()` returns to idle; call `start()` again for PvP/singleplayer.
AI-vs-AI still starts through `step()` or `run()`.
AI failures publish error state and then reject with the original strategy error;
ordinary refusals retain existing status values.
Stage 3 introduces the agreed action envelope, restart, stop, undo and disposal.
Worker/WASM execution and framework adapters remain later work.
