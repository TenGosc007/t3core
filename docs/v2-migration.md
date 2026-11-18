# V2 migration in progress

This branch contains staged breaking changes intended for v2. It has not changed
the package version or published a release. Stages 2 and 3 change session
observation, lifecycle and action results.

## Session snapshots

`TicTacToe.snapshot`, direct session `snapshot`, and the new stable, bound
`getSnapshot()` return a full `SessionSnapshot`, rather than the underlying
`GameEventPayload`. Facade instances narrow this to `SnapshotFor<Mode>`.

Existing reads of `board`, `currentPlayer` and `gameStatus` continue to work.
Use `phase === 'ai-thinking'` for progress, `canPlay` for human input, and
`legalMoves` for legal indices. The variant descriptor supplies dimensions and
win length; constructor selection remains the string `classic-3x3`.
Session `movesCount` counts moves in the current position, rather than retained
future history. `canUndo` indicates whether `undo()` can restore a move/decision.
This also works when a direct session receives a pre-populated Game before start.

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
of leaving a permanent thinking indicator; resume with start/step/run or restart.
This also applies when a low-level Game callback interrupts a session move.

Direct session constructors may receive a pre-populated `Game`. After session
construction, perform mutations through the session. Mutating the injected
`Game` directly bypasses coherent session publication. `Game.snapshot` and its
`STATE_CHANGE` event remain the separate, unchanged low-level API.

## Lifecycle

Replace a new-game sequence of `reset(); await start()` with one
`await restart()`. PvP/singleplayer start automatically, including an AI opening.
AI-vs-AI returns to `ai-ready` without resuming a previous autoplay loop.

Repeated `start()` on an active/finished session succeeds without notifications
or repeated opening events. While another action owns the lock it returns a
`busy` refusal. `stop()` cancels active work, preserves the board and publishes
`paused`. Resume via `start()` or AI-vs-AI `step()` / `run()`.
Stop before start, while already paused, after completion or in the error phase
is a successful no-op; it cannot clear a failure and bypass error recovery.

`undo()` restores one move in PvP/AI-vs-AI. Single-player restores the position
before the last human decision, including any subsequent AI reply. A lone AI
opening is preserved. A valid undo cancels pending work and clears error state.
It restores a human turn or `ai-ready`, preserves an existing pause, and does
not emit new-move/turn events or start AI. No history means a `no_history`
refusal without cancelling the current calculation.

`dispose()` cancels work, publishes one final frozen `disposed` snapshot,
removes subscriptions and gameplay listeners, and permanently closes the session.
It preserves the board, result and error. Repeated disposal is safe. New
subscriptions after disposal return inert cleanup functions; actions refuse with
`disposed`. A callback can dispose safely during another notification.
Subscriber exceptions still propagate, but disposal always removes listeners.

The deprecated `reset(): void` remains temporarily available until the final
API review in stage 5. It retains its reset-to-idle semantics and does nothing
after disposal. New application code should use `restart()`.

## Action results

| Before | Replacement |
| --- | --- |
| `{ status: 'success' }` | `{ status: 'success', value: undefined }` |
| `{ status: 'busy' }`, `invalid_index`, `already_selected` | `{ status: 'rejected', reason: ... }` |
| `game_not_running` before start / during pause / after finish | `rejected` with `not_started` / `paused` / `game_finished` |
| `run(): { status: 'completed', result }` | `{ status: 'success', value: result }`; result is a win or draw |
| A rejected Promise for an AI failure | `{ status: 'error', error: { code, message } }` plus the error snapshot |
| `{ status: 'aborted' }` | Same shape, also used for stop/restart/undo/dispose |

Each method's return type narrows its refusal reasons and success value.
`stop` and `undo` are synchronous; other actions return promises; `dispose`
returns void. Check `status` before reading `reason`, `error` or `value`.
Do not rely on `.catch()` to handle AI errors now. Constructor and application
callback exceptions still throw and remain separate from ordinary action results.
The error phase blocks start/playMove/step/run with `session_error` until
restart or a valid undo clears the failure.

Cancellation settles an old action as `aborted` without waiting for an unresolved
strategy promise. Late success, illegal indices and rejections are ignored;
they cannot change a newer game or release its lock. This is logical cancellation:
the current strategy contract still has no AbortSignal or resource cleanup hook.
It cannot preempt synchronous JavaScript or terminate a custom Worker.
Provider signals and resource ownership arrive in stage 4.

Worker/WASM execution and framework adapters remain later work.
