# V2 migration in progress

This branch contains staged breaking changes intended for v2. It has not changed
the package version or published a release. The completed stages change session observation, lifecycle and action results,
and add shared rule validation, provider configuration, capability discovery
and cooperative cancellation. Stage 5 consolidates exports and removes
transitional session reset.

## Public entry point

V2 deliberately reduces runtime exports to `TicTacToe` and `AIProviderError`.
All other root exports are types. This is a major-version migration; do not
publish this branch as a 1.x patch or minor release. The version stays unchanged
until the explicit release process.

| Removed consumer API | Replacement |
| --- | --- |
| `Game`, `PvPGame`, `SinglePlayerGame`, `AIGame` | `new TicTacToe({ mode, ... })` |
| `GameVariant.CLASSIC_3X3`, `AIDifficulty.HARD` | `'classic-3x3'`, `'hard'` configuration strings |
| `AlphaBetaStrategy`, `RandomStrategy` | `ai: { engine: 'alphabeta' | 'random', ... }`, or separate `aiPlayers` entries |
| `getBestMove`, `AIOptions`, `AIMoveResult`, `MoveStrategy`, `MoveContext`, `GameView` | Facade-owned AI turns; custom selection through `AIProvider` / `AIStrategy` |
| `GameEvent.STATE_CHANGE`, `GameEventPayload`, `GameEventMap` | Bound `subscribe()` and full `getSnapshot()` |
| `PlayerMoveStatus`, `BackToMoveStatus`, `BackToMoveStatusType` | Typed action results; use `playMove()` / `undo()` rather than domain mutation |
| `IGame`, `IBoard`, `GameOptions`, `GameVariantType`, `PlayerSymbols`, `GameSession` | Mode-specific options/instances, `BoardSnapshot`, `PlayerSymbol`, `VariantId` |
| `DEFAULT_GAME_SYMBOLS` | Fixed `'O'` / `'X'`; read `currentPlayer` and `humanSymbol` |
| `backToMove(index)` | `undo()` for the supported previous decision; arbitrary history jumps/redo are outside the facade |
| Session/facade `reset()` | `await restart()` for a new game; `stop()` for pause |

`PlayerSymbol`, `BoardField`, `BoardSnapshot` and `GameStatus` now reference the
same immutable O/X contracts used by snapshots and providers. Custom TypeScript
code accepting arbitrary string symbols must narrow to O/X. Constructor runtime
validation also rejects unsupported symbols. Configuration, instance, snapshot,
event, action result and provider types remain root type exports; see
[src/index.ts](../src/index.ts) for the complete list.

```js
// Before: compose a domain game, strategy and session yourself.
const session = new SinglePlayerGame({
  game: new Game(),
  strategy: new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD }),
  humanSymbol: 'O', aiSymbol: 'X',
});

// After: the facade owns construction, AI and resources.
const game = new TicTacToe({
  mode: 'singleplayer', humanSymbol: 'O',
  ai: { engine: 'alphabeta', difficulty: 'hard' },
});
```

Import only from `t3core`. There is no legacy or source subpath and no
`t3core/react` entry yet. The constructor returns a mode-specific facade with
only that mode's actions; use `mode` rather than `instanceof` or constructor
identity. Existing low-level modules remain internal to preserve rule/search
separation and their regression coverage; they are not an alternative public API.

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
for each registration. It now notifies for phase changes as well as moves/restart:

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

Callbacks run synchronously and can unsubscribe, stop or restart. A nested state change
supersedes the remaining notification delivery for the old snapshot. An action
started from a ready-state callback is accepted; it supersedes the old operation's
remaining events and result (`aborted`). Only the owning operation releases its
lock. Restart also invalidates late AI results and rejections.

Application callback exceptions propagate without rollback. If a callback
interrupts an AI turn before completion, the session publishes `paused` instead
of leaving a permanent thinking indicator; resume with start/step/run or restart.
This also applies when a low-level Game callback interrupts a session move.

The domain Game and direct session constructors are now internal. Consumer
mutations go through the facade, which owns coherent snapshot publication.
Read position changes through `subscribe`, rather than a domain `STATE_CHANGE`
listener. Gameplay effects can keep using the facade’s `on`/`off` events.

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

`reset(): void` is removed from sessions and the facade. Replace it with
`await restart()` for a new game, or `stop()` when cleaning up a reusable view.
Restart starts human-driven games immediately, so it is not a drop-in alias
for the former reset-to-idle method.

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
they cannot change a newer game or release its lock. Stage 4 also aborts the
active request's `AbortSignal`. Cancellation cannot preempt synchronous
JavaScript; providers must stop their own background work when signalled.

## Custom AI and configuration

Use `AIProvider<'engine-id', Options>` through `aiProviders`, then select the
provider with `ai.engine` or either `aiPlayers` configuration. Each provider
supplies metadata, `validateOptions(unknown): Options`, and a synchronous
`create(options): AIStrategy`. See the [provider guide](ai-providers.md) for
a complete example. Keep each engine ID as a literal generic argument to retain
engine-specific option inference. Broad `AIProvider[]` annotations erase that
relationship; prefer inferred provider tuples.

The target strategy receives `(input, { signal })`, with frozen board, O/X
symbols, status, variant metadata and stateless rules for simulation. It must
return a legal index and implement `dispose()`. Initialize expensive resources
lazily during calculation. Resources belong privately to each player/session;
disposal releases them once, including when a subscriber throws. Stop/restart/undo
preserve resources and RNG sequence. A new request may start immediately after
cancellation, so providers must distinguish pending background requests.

Direct `MoveStrategy` and session constructors are no longer consumer exports.
Migrate custom move selection to `AIProvider` / `AIStrategy`; pass the provider
in configuration rather than constructing a session. Internal board/context
adapters remain implementation details.

`TicTacToe.getCapabilities({ variant, aiProviders })` returns frozen compatible
engine and mode metadata without validating player options, creating engines or
loading resources. Only `classic-3x3` is public. Larger variants stay deferred.

Configuration now rejects unknown top-level and built-in AI fields, fields
belonging to another mode, unknown/duplicate engine IDs, incompatible variants,
unsupported difficulties and non-finite seeds. Remove `difficulty` entirely from
`engine: 'random'` configurations, even when its value was `undefined`.
Alpha-beta still defaults to `normal`; normal/hard behavior and seeds are
preserved. Both AI player configurations are validated before factories run.
Invalid options and synchronous factory failures throw from construction.

The internal Game and provider input share variant rules. Human and AI answers
pass through the same legality gate. `illegal_move` is an additional human
refusal; AI rule
violations use `illegal_ai_move`. Providers can throw `AIProviderError` with
`ai_initialization_failed` or `ai_timeout`; sessions expose these codes as
serializable error actions. Other calculation failures remain `ai_failed`.

Worker/WASM execution and framework adapters remain later work.
