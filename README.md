# t3core

A framework-independent TypeScript engine for Tic Tac Toe. Use one facade to
create a game, observe its state and manage human or AI turns.

> This branch implements the **v2 API**. The package version is still `1.6.0`;
> these breaking changes must ship in a major release. See the
> [migration guide](docs/v2-migration.md). No release has been published here.
>
> Looking for the CLI? See [t3core-cli](https://github.com/TenGosc007/t3core-cli).

## Installation

This command installs the published 1.x package. The examples below need the
v2 API, which is not published yet.

```sh
npm install t3core
```

The examples below describe this branch's v2 API. TypeScript consumers need
TypeScript 5.4 or newer. ESM and CommonJS are supported; importing the package
requires no DOM, React or Worker globals.

## Human vs AI

```js
import { TicTacToe } from 't3core';

const game = new TicTacToe({
  mode: 'singleplayer',
  variant: 'classic-3x3',
  humanSymbol: 'O',
  ai: { engine: 'alphabeta', difficulty: 'hard', seed: 123 },
});

// render is supplied by your application.
const renderGame = () => render(game.getSnapshot());
const unsubscribe = game.subscribe(renderGame);
renderGame();

await game.start();
const result = await game.playMove(4); // Human move and AI reply.
if (result.status === 'error') console.error(result.error);

await game.restart(); // Clears the board and starts the next game.

// When permanently removing the board:
unsubscribe();
game.dispose();
```

Symbols are fixed to `O` and `X`; `O` starts. With `humanSymbol: 'X'`, `start()`
performs the AI opening. Construction performs no moves, so subscribe before
starting. A human move ending the game does not trigger an AI reply.

Only `classic-3x3` is currently implemented. Omitted AI configuration selects
alpha-beta at `normal` difficulty. `normal` searches one ply with a 30% mistake
rate; `hard` searches four plies with a 10% mistake rate. Neither is unbeatable.
The random engine takes `{ engine: 'random', seed?: number }`, with no difficulty.
Seeds must be finite numbers. Restart preserves the engine's RNG sequence;
create a fresh instance with the same seed to replay it from the beginning.

## PvP

```js
const game = new TicTacToe({ mode: 'pvp' });
await game.start();
await game.playMove(4); // O
await game.playMove(0); // X
// Subscribe and dispose as in the example above.
```

## AI vs AI

```js
const game = new TicTacToe({
  mode: 'aivsai',
  aiPlayers: [
    { engine: 'alphabeta', difficulty: 'hard', seed: 1 }, // O
    { engine: 'random', seed: 2 },                        // X
  ],
});

await game.step(); // One move; no start() required.
const result = await game.run(); // Remaining moves to a terminal result.
if (result.status === 'success') console.log(result.value); // Win or draw.
game.dispose();
```

The instance exposes only its mode's actions, in both JavaScript and TypeScript.
Options typed as `TicTacToeOptions`, with the mode chosen at runtime, return a
union of instance types; narrow it with `game.mode`.

## Observe and control a game

`getSnapshot()` and `subscribe(callback)` are stable, bound functions. The full
snapshot is frozen and cached until a state change. Repeated reads return the
same reference. A phase change preserves the board and legal-moves references.
Subscription registration does not notify immediately; render once explicitly.
Each registration returns independent, idempotent cleanup.

| Snapshot data | Purpose |
| --- | --- |
| `board`, `currentPlayer`, `gameStatus` | Frozen position, current O/X symbol, running/win/draw result |
| `phase` | `idle`, `human-turn`, `ai-ready`, `ai-thinking`, `paused`, `finished`, `error`, `disposed`; narrowed by mode |
| `canPlay`, `legalMoves` | Human input availability and legal zero-based indices |
| `mode`, `humanSymbol`, `variant` | Mode, human symbol or null, and resolved variant descriptor |
| `movesCount`, `canUndo`, `error` | Moves in the current position, undo availability, serializable AI failure or null |

Show a thinking indicator when `phase === 'ai-thinking'`, and disable input
unless `canPlay` is true. Subscribers see the human move with `ai-thinking`,
then the AI reply with `human-turn` or `finished`. A snapshot is published before
its gameplay event. Short 3×3 calculations may finish before the browser paints;
future costly providers will need background execution or cooperative scheduling.

| Method | Behavior |
| --- | --- |
| `start()` / `playMove(index)` | Start/resume and human input in PvP/singleplayer |
| `step()` / `run()` | One AI move or autoplay in AI-vs-AI |
| `restart()` | Cancel old work, clear history and start human-driven modes; AI-vs-AI returns to `ai-ready` |
| `stop()` | Synchronously pause while preserving the board; resume through start/step/run |
| `undo()` | Synchronously restore one ply in PvP/AI-vs-AI or the last human decision including its AI reply |
| `dispose()` | Permanently close, cancel work, release AI resources and remove listeners |
| `getSnapshot()` / `snapshot` | Read the same complete session snapshot |
| `board`, `currentPlayer`, `gameStatus`, `movesCount`, `mode` | Convenient read-only accessors |
| `subscribe(callback)` | Observe all snapshot changes, including phase-only changes |
| `on(event, handler)` / `off(event, handler)` | Optional gameplay effects; use the same handler reference for removal |

Repeated start on an active or finished game succeeds without replaying turns.
Undo cancels a pending reply, clears an AI error when history permits, preserves
pause and never starts AI. An AI opening alone cannot be undone. Stop/restart/undo
retain engine resources; dispose releases them once. The final snapshot remains
readable after disposal, while later actions refuse with `disposed`.

Events are `move: { player, position }`, `turn: { player }`,
`ai-thinking: { player }`, and `finished: { result }`. They describe gameplay;
snapshot subscriptions supply render state.

## Action results and errors

```js
const result = await game.playMove(4);
switch (result.status) {
  case 'success': break; // value is undefined; run() supplies a terminal result.
  case 'rejected': console.log(result.reason); break; // busy, invalid_index, etc.
  case 'aborted': break; // Newer work superseded this operation.
  case 'error': console.error(result.error.code, result.error.message); break;
}
```

| Method | Return type | Possible refusal reasons |
| --- | --- | --- |
| `start()` | `Promise<StartResult>` | `busy`, `session_error`, `disposed` |
| `playMove(index)` | `Promise<PlayMoveResult>` | `not_started`, `paused`, `game_finished`, `busy`, `invalid_index`, `already_selected`, `illegal_move`, `session_error`, `disposed` |
| `step()` | `Promise<StepResult>` | `game_finished`, `busy`, `session_error`, `disposed` |
| `run()` | `Promise<RunResult>` | `busy`, `session_error`, `disposed` |
| `restart()` | `Promise<RestartResult>` | `disposed` |
| `stop()` | `StopResult` | `disposed` |
| `undo()` | `UndoResult` | `no_history`, `disposed` |
| `dispose()` | `void` | None; repeated disposal is safe. |

Success contains `value: undefined`, except `run()`, whose value is a win or draw.
Repeating `run()` after completion returns the existing terminal result without
notifications. Restart and valid undo cancel pending work instead of refusing
with `busy`. Stop and undo can report `aborted` when a reentrant callback
supersedes them; neither runs AI or returns an AI error.

Ordinary refusals do not enter the error phase.
AI failures are data and also appear in the snapshot.
The error phase blocks new moves until restart or a valid undo. Constructor
validation failures and application callback exceptions still throw; applied
moves are not rolled back when a callback throws.

Stop, restart, valid undo and disposal signal cancellation immediately. Old
actions settle as `aborted` even if a provider ignores its signal or never
resolves. Late answers cannot alter the current game. Signals cannot preempt
synchronous JavaScript.

## Custom AI and availability

```js
const capabilities = TicTacToe.getCapabilities({ variant: 'classic-3x3' });
console.log(capabilities.modes, capabilities.aiEngines);
```

This returns frozen metadata without creating strategies or initializing AI.
Register your own `AIProvider<'engine-id', Options>` through `aiProviders` and
select it with `ai.engine` or either `aiPlayers` entry. Options are tied to the
registered engine ID. See the [provider guide](docs/ai-providers.md) for the full
contract, simulation rules, cancellation, failures and cleanup.

The only runtime exports are `TicTacToe` and `AIProviderError`. Configuration,
instances, snapshots, domain data, action results, events, rules and provider
contracts are `export type` entries in [src/index.ts](src/index.ts). Internal
classes and source paths are not supported consumer imports.

## Framework integration

The core has no UI dependency. Its bound `subscribe` and stable `getSnapshot`
provide the external-store contract needed by React's `useSyncExternalStore`.
Create one instance per mounted board. A reusable effect cleanup should call
`stop()` so React Strict Mode can resume the same instance; its permanent owner
calls `dispose()`. Selectors and a dedicated `t3core/react` entry remain future
work; this change adds no framework hooks.

For SSR, retain a suitable initial snapshot as `getServerSnapshot`. Pass plain
snapshot data across server/client boundaries, never game class instances.
Create browser-side instances in the client; avoid shared module-level games.

For contributor setup, checks and package verification, see
[CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
Larger boards, actual Worker/WASM execution and framework adapters remain
outside this 3×3 implementation.

## License

[ISC](LICENSE).
