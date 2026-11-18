# V2 contracts and implementation status

This document describes the target `2.0.0` API and its implementation status.
Stage 2 implements full session snapshots, bound `getSnapshot`
and `subscribe`, phase notifications and serializable AI error state. Stage 3
implements the lifecycle methods and shared action result envelope. Stage 4
implements configuration validation, shared variant rules and AI providers.
Use the [README](../README.md) and [migration notes](v2-migration.md) for the
currently implemented API. The package version is unchanged.

The contracts below are used by runtime code. The final export review and
removal of transitional API remain stage 5.

## Contract ownership

| File | Responsibility |
| --- | --- |
| [game/contracts.ts](../src/game/contracts.ts) | Fixed O/X symbols, immutable position types, implemented variant metadata, and running/terminal results. |
| [sessions/state/types.ts](../src/sessions/state/types.ts) | Mode-aware session snapshots and valid phase/result/input combinations. |
| [sessions/results.ts](../src/sessions/results.ts) | Action results, method-specific refusals, and serializable AI errors. |
| [facade/options.ts](../src/facade/options.ts) | Mode-specific configuration with options tied to registered AI engine IDs. |
| [facade/types.ts](../src/facade/types.ts) | Runtime per-mode instances, generic constructor and static discovery. |
| [ai/providers/types.ts](../src/ai/providers/types.ts) | Provider metadata, normalized option validation, private factories and cancellable strategies. |
| [facade/catalog/types.ts](../src/facade/catalog/types.ts) | Read-only capability discovery inputs and outputs. |
| [strategies/strategies.types.ts](../src/strategies/strategies.types.ts) | Public simulation rules and internal variant strategy contract. |

The session snapshot types are now used by runtime sessions and exported from
the package root, together with `EngineError`. Consumers must not import source
paths. Internal `facade/contracts` files now re-export the adopted runtime
contracts, with no separate option definitions. Transitional direct-session and
low-level exports remain subject to the final API review. See the
[provider guide](ai-providers.md) for custom engines and capability discovery.

Only `classic-3x3` is accepted. Future 9x9/Gomoku identifiers are not added to
the type union or variant registry. The random engine does not accept a
difficulty; alpha-beta accepts `normal` or `hard` and remains the default.

## JavaScript usage

These lifecycle flows are implemented. `render` is supplied by the application.
Subscribe before starting, perform an initial render explicitly, and dispose
the instance when permanently removing the view.
The compiled [usage scenarios](../src/tests/contracts/examples.ts) use an
injected constructor with the same runtime configuration types. The runtime
facade is also exercised by the session tests and installed package consumers.

### Local PvP

```js
const game = new TicTacToe({ mode: 'pvp', variant: 'classic-3x3' });
const unsubscribe = game.subscribe(() => render(game.getSnapshot()));
render(game.getSnapshot());

const started = await game.start();
if (started.status === 'success') {
  const moved = await game.playMove(4); // O; the next accepted move belongs to X.
  handleResult(moved);
} else {
  handleResult(started);
}

// The new-game button calls await game.restart().
// On view removal:
unsubscribe();
game.dispose();
```

### Human vs AI

```js
const game = new TicTacToe({
  mode: 'singleplayer',
  variant: 'classic-3x3',
  humanSymbol: 'O',
  ai: { engine: 'alphabeta', difficulty: 'hard', seed: 123 },
});

const unsubscribe = game.subscribe(() => {
  const state = game.getSnapshot();
  render(state); // Read phase for the thinking indicator and canPlay for input.
});
render(game.getSnapshot());

const started = await game.start();
if (started.status === 'success') {
  const state = game.getSnapshot();
  const index = state.legalMoves[0];
  if (state.canPlay && index !== undefined) {
    handleResult(await game.playMove(index)); // Includes the AI reply.
  }
} else {
  handleResult(started);
}

// Setting humanSymbol to X makes start() perform the AI opening first.
// restart() also performs that opening without another start() call.
unsubscribe();
game.dispose();
```

Snapshots show the human move with `ai-thinking`, then the AI reply with
`human-turn` or `finished`. No AI reply occurs after a terminal human move.
The UI must not maintain its own authoritative copy of the thinking state.

### AI vs AI

```js
const game = new TicTacToe({
  mode: 'aivsai',
  variant: 'classic-3x3',
  aiPlayers: [
    { engine: 'alphabeta', difficulty: 'hard', seed: 1 }, // O
    { engine: 'random', seed: 2 },                        // X
  ],
});
const unsubscribe = game.subscribe(() => render(game.getSnapshot()));
render(game.getSnapshot());

const stepped = await game.step();
if (stepped.status === 'success') {
  handleResult(await game.run()); // Finish the remaining game.
} else {
  handleResult(stepped);
}

// restart() returns to ai-ready; step() or run() explicitly resumes play.
unsubscribe();
game.dispose();
```

There is no `start` or `playMove` on an AI-vs-AI instance. `step` and `run`
start/resume it themselves. `ai-ready` means no calculation is active;
`ai-thinking` identifies an active AI calculation. Human input stays disabled.

### Handle action outcomes

```js
function handleResult(result) {
  switch (result.status) {
    case 'success':
      // run() supplies a terminal game result in value; other actions use undefined.
      break;
    case 'rejected':
      console.log('Action refused:', result.reason);
      break;
    case 'aborted':
      // An old operation was invalidated; render the current snapshot.
      break;
    case 'error':
      console.error(result.error.code, result.error.message);
      break;
  }
}
```

Ordinary refusals do not put the session in its error phase. An active AI
failure does; a stale failure after cancellation must not overwrite a new game.
Invalid constructor options and application listener exceptions still throw.

## Method outcomes

| Method | Return type | Possible refusal reasons |
| --- | --- | --- |
| `start` | `Promise<StartResult>` | `busy`, `session_error`, `disposed` |
| `playMove` | `Promise<PlayMoveResult>` | `not_started`, `paused`, `game_finished`, `busy`, `invalid_index`, `already_selected`, `illegal_move`, `session_error`, `disposed` |
| `step` | `Promise<StepResult>` | `game_finished`, `busy`, `session_error`, `disposed` |
| `run` | `Promise<RunResult>` | `busy`, `session_error`, `disposed` |
| `restart` | `Promise<RestartResult>` | `disposed` |
| `stop` | `StopResult` | `disposed` |
| `undo` | `UndoResult` | `no_history`, `disposed` |
| `dispose` | `void` | None; repeated disposal is safe. |

Success contains `value: undefined`, except `run`, whose value is a win or draw.
Repeated `start` on an active or finished session is a successful no-op unless
another incompatible operation owns the lock. Repeated `run` after completion
returns the existing terminal outcome. Restart and undo cancel pending AI work
instead of reporting busy. A completed stop/undo can report aborted when a
reentrant callback invalidates it; neither operation runs AI or returns an AI error.

## Snapshot guarantees and validation boundaries

- Narrowing on `phase` determines input availability and the game result.
  `finished` cannot coexist with `running` or `canPlay: true`.
- PvP cannot enter AI phases; AI-vs-AI cannot enter `human-turn`.
- The error phase carries an AI error and a still-running position. Disposed
  snapshots retain the last result/error but disable play and undo.
- Arrays, variant metadata, results and error descriptions are readonly.
- Types cannot prove board length, numeric bounds, occupancy, turn ownership,
  or correspondence between a board and its result. Runtime rules validate moves;
  the session boundary validates O/X data and freezes the complete snapshot.
- Stage 2 tests verify cached snapshot identity, stable bound methods, publication
  ordering and independent unsubscribe cleanup; types alone cannot enforce them.

Contract tests run through both `yarn ts:check` and Vitest. Type checking also
verifies negative consumer examples marked with `@ts-expect-error`; Vitest
alone does not validate those compiler diagnostics.

Lifecycle actions are implemented in stage 3 and providers in stage 4; final
package migration remains stage 5. The final review also removes remaining temporary
“Internal v2” annotations and duplicate draft types after their runtime adoption.
