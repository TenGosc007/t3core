# TIC-TAC-TOE-CORE (t3core)

A reusable TypeScript core library for Tic Tac Toe games.

> **Looking for the interactive CLI game?**  
> See [t3core-cli](https://github.com/TenGosc007/t3core-cli) — `npx t3core-cli`

## Installation

```bash
npm install t3core
```

## Usage as a Library

Use `TicTacToe` for session-based gameplay. Its instance type depends on the selected mode: `pvp` and `singleplayer` expose `start()` / `playMove()`, while `aivsai` exposes `step()` / `run()`.

```typescript
import { TicTacToe, AIDifficulty } from 't3core';

const game = new TicTacToe({
  mode: 'singleplayer',
  humanSymbol: 'O',
  ai: { difficulty: AIDifficulty.HARD, seed: 12345 },
});

game.on('move', ({ player, position }) => {
  console.log(player, position);
});
game.on('finished', ({ result }) => {
  console.log(result);
});

await game.start();
await game.playMove(4);
```

Register listeners before calling `start()`. In single-player mode, one `await playMove(index)` applies the human move and the AI reply, unless the human move ends the game. The default AI uses alpha-beta with `NORMAL` difficulty; use `humanSymbol: 'X'` to let the AI start.

### Low-level `Game` API

Use `Game` directly when you want to manage turns and AI orchestration yourself.

```typescript
import { Game, GameVariant } from 't3core';

// Create a game with default symbols 'O' and 'X'
const game = new Game({ variant: GameVariant.CLASSIC_3X3 });

// Make a move (index 0-8)
game.savePlayerMove(4); // Places 'O' at center (index 4)

// Check game status
console.log(game.gameStatus); // { status: 'running' } | { status: 'win', winner: 'O' } | { status: 'draw' }
console.log(game.currentPlayer); // 'O' or 'X'

// Check if field is already selected
console.log(game.isFieldSelectedByIndex(4)); // true

// Access the board
console.log(game.board); // [1, 2, 3, 4, 'O', 6, 7, 8, 9]

// Reset the game
game.reset();
```

### Next.js / Server Components

> **Note:** `Game` instances are not serializable — do not pass them as props across the server → client boundary. Keep the instance on the client side (e.g. in `useRef` or module scope) and pass only the plain snapshot object through props:
>
> ```tsx
> // ✅ pass plain state
> <GameBoard state={game.snapshot} />
>
> // ❌ will throw — class instances are not serializable
> <GameBoard game={game} />
> ```

### React Integration with `useSyncExternalStore`

```tsx
import { useSyncExternalStore } from 'react';
import { Game, GameEvent } from 't3core';

// Create a stable game instance (outside React or in a ref)
const game = new Game();

function useTicTacToe() {
  const state = useSyncExternalStore(
    // Subscribe function
    (callback) => {
      game.on(GameEvent.STATE_CHANGE, callback);
      return () => {
        game.off(GameEvent.STATE_CHANGE, callback);
      };
    },
    // Get snapshot function
    () => game.snapshot
  );

  return {
    board: state.board,
    currentPlayer: state.currentPlayer,
    gameStatus: state.gameStatus,
    makeMove: (index: number) => game.savePlayerMove(index),
    reset: () => game.reset(),
  };
}

// Component usage
function TicTacToeBoard() {
  const { board, currentPlayer, gameStatus, makeMove, reset } = useTicTacToe();

  return (
    <div>
      <p>Current Player: {currentPlayer}</p>
      <div className="board">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => makeMove(index)}
            disabled={typeof cell === 'string'}
          >
            {typeof cell === 'string' ? cell : ''}
          </button>
        ))}
      </div>
      {gameStatus.status === 'win' && <p>Winner: {gameStatus.winner}!</p>}
      {gameStatus.status === 'draw' && <p>It's a draw!</p>}
      <button onClick={reset}>Reset Game</button>
    </div>
  );
}
```

### API

#### `Game`

| Property/Method | Description |
| --------------- | ----------- |
| `constructor(options?)` | Create a new game. `options.variant` selects a predefined variant (default: `classic-3x3`) |
| `currentPlayer` | Get the current player's symbol |
| `gameStatus` | Get current game status |
| `board` | Get current board state as `readonly BoardField[]` |
| `snapshot` | Stable snapshot for `useSyncExternalStore` (returns `GameEventPayload`) |
| `savePlayerMove(index: number)` | Place current player's symbol at index 0-8. Returns `PlayerMoveStatus` (`success`, `already_selected`, `game_not_running`, `invalid_index`) |
| `isFieldSelectedByIndex(index: number)` | Check if a field is already occupied |
| `movesCount` | Number of moves made in the current game |
| `backToMove(index: number)` | Restore the board to a previous history state at the given index. Returns `BackToMoveStatus` (`success`, `invalid_history_index`) |
| `on(event, fn)` | Subscribe to events (`STATE_CHANGE`). Returns `this` for chaining |
| `off(event, fn)` | Unsubscribe from events. **Requires the same function reference passed to `on()`** — store listeners in named variables, not inline arrow functions |
| `reset()` | Reset the game to initial state. Emits `STATE_CHANGE` |

### Events

Subscribe to game events with typed payloads:

```typescript
import { Game, GameEvent } from 't3core';

const game = new Game();

// STATE_CHANGE — emitted after every savePlayerMove, backToMove, and reset
game.on(GameEvent.STATE_CHANGE, ({ board, currentPlayer, gameStatus }) => {
  console.log('State changed:', { board, currentPlayer, gameStatus });
});

// Remember to use named functions (not arrow functions) if you need to unsubscribe later
function onStateChange(payload) {
  console.log('State changed:', payload);
}
game.on(GameEvent.STATE_CHANGE, onStateChange);
game.off(GameEvent.STATE_CHANGE, onStateChange); // works
```

## Exports

```typescript
// Core class
export { Game } from 't3core';

// Constants
export { DEFAULT_GAME_SYMBOLS } from 't3core';

// Variants
export { GameVariant } from 't3core';

// Types
export type { GameOptions, IGame, GameStatus, GameVariantType, PlayerSymbol, PlayerSymbols } from 't3core';
export type { GameEventMap, GameEventPayload } from 't3core';
export type { BoardField, BoardSnapshot, IBoard } from 't3core';
export type { BackToMoveStatusType, PlayerMoveStatus } from 't3core';

// Events
export { GameEvent } from 't3core';

// Statuses
export { BackToMoveStatus, PlayerMoveStatus } from 't3core';

// AI (Single Player)
export { TicTacToe, getBestMove, AIDifficulty, AlphaBetaStrategy, RandomStrategy, MoveStrategyError } from 't3core';
export type { AIOptions, AIMoveResult } from 't3core';
export { PvPGame, SinglePlayerGame, AIGame } from 't3core';
export type { MoveStrategy, MoveContext, GameView, GameSession, GameSessionEvent } from 't3core';
export type { TicTacToeOptions, PvpOptions, SinglePlayerOptions, AivsAiOptions, AIConfig } from 't3core';
export type { PvPInstance, SinglePlayerInstance, AivsAiInstance, TicTacToeConstructor } from 't3core';
export type { GameSessionEventType, GameSessionEventPayload, PlayMoveResult, StartResult, RunResult } from 't3core';
```

## Single Player (AI)

`t3core` ships an AI opponent for the classic 3x3 variant, based on Alfa-Beta pruning with difficulty knobs (depth limit + mistake rate). Two difficulty levels are available — no unbeatable level, so the player always has a chance to win.

| Level | Depth | Mistake rate | Behavior |
|-------|-------|--------------|----------|
| `AIDifficulty.NORMAL` | 1 | 30% | Sees only immediate moves; often plays randomly. Very beatable. |
| `AIDifficulty.HARD` | 4 | 10% | Looks 4 plies ahead; occasional blunders. Strong, but beatable. |

### PvP

```typescript
import { TicTacToe } from 't3core';

const game = new TicTacToe({ mode: 'pvp' });

await game.start();
await game.playMove(4);
await game.playMove(0);
```

### AI vs AI

```typescript
import { TicTacToe, AIDifficulty } from 't3core';

const game = new TicTacToe({
  mode: 'aivsai',
  aiPlayers: [
    { difficulty: AIDifficulty.HARD, seed: 1 },
    { engine: 'random', seed: 2 },
  ],
});

const result = await game.run();
console.log(result);
```

All sessions emit `move`, `turn`, and `finished`; AI sessions also emit `ai-thinking`. `reset()` clears the board and aborts in-flight work. Call `start()` again after reset in human-driven modes. Concurrent operations return `busy`; operations invalidated by reset return `aborted`.

For custom AI, implement `MoveStrategy.calculateMove(board, context): Promise<number>` and pass it to `SinglePlayerGame` or pass two strategies to `AIGame`, together with a `Game` instance. Strategies must return an empty cell's index. Invalid moves and strategy failures reject the operation; a strategy reporting `no_legal_moves` during a running game is an error, not a completed game.

### `getBestMove` — stateless helper

```typescript
import { Game, getBestMove, AIDifficulty } from 't3core';

const game = new Game();
const result = getBestMove(game, {
  difficulty: AIDifficulty.HARD,
  symbol: 'O',
  opponentSymbol: 'X',
  seed: 12345,            // optional — for reproducible behavior
});
if (result.status === 'success') {
  game.savePlayerMove(result.index);  // caller applies the move
}
```

### AI API

| Export | Description |
| ------ | ----------- |
| `TicTacToe` | Typed facade for `pvp`, `singleplayer`, and `aivsai` sessions |
| `PvPGame`, `SinglePlayerGame`, `AIGame` | Sessions wrapping a low-level `Game`, with lifecycle controls and typed events |
| `AlphaBetaStrategy`, `RandomStrategy` | Asynchronous move strategies with persistent seeded RNG |
| `MoveStrategy`, `MoveContext`, `GameView` | Contracts for custom strategies and read-only AI state |
| `MoveStrategyError` | Strategy failure with a `no_legal_moves` or `illegal_move` code |
| `getBestMove(game, options?)` | Stateless helper. Returns `success` with an index, `no_moves`, or `invalid_state`. Does not mutate the game |
| `AIDifficulty` | Enum: `NORMAL`, `HARD` |
| `AIOptions` | Type: `{ difficulty?, symbol?, opponentSymbol?, seed? }` |
| `AIMoveResult` | Type: discriminated union on `status` |

> **Note:** `getBestMove` and `AlphaBetaStrategy` support only the 3x3 variant (9-cell board). Passing a different board size throws `RangeError`. `getBestMove` defaults to `game.currentPlayer`; supplying a different `symbol` returns `invalid_state`. When using this helper on an empty board, provide `opponentSymbol` explicitly. Sessions supply the strategy context automatically.
