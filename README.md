# TIC-TAC-TOE-CORE (t3core)

A reusable TypeScript core library for Tic Tac Toe games.

> **Looking for the interactive CLI game?**  
> See [t3core-cli](https://github.com/TenGosc007/t3core-cli) — `npx t3core-cli`

## Installation

```bash
npm install t3core
```

## Usage as a Library

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
| `constructor(options?)` | Create a new game. `options.variant` selects a predefined variant (default: `classic-3x3`). `options.boardSize` is deprecated and will be removed in v2.0 |
| `currentPlayer` | Get the current player's symbol |
| `gameStatus` | Get current game status |
| `board` | Get current board state as `readonly BoardField[]` |
| `snapshot` | Stable snapshot for `useSyncExternalStore` (returns `GameEventPayload`) |
| `savePlayerMove(index: number)` | Place current player's symbol at index 0-8. Returns `PlayerMoveStatus` (`success`, `already_selected`, `game_not_running`, `invalid_index`) |
| `isFieldSelectedByIndex(index: number)` | Check if a field is already occupied |
| `movesCount` | Number of moves made in the current game |
| `backToMove(index: number)` | Restore the board to a previous history state at the given index. Returns `BackToMoveStatus` (`success`, `invalid_history_index`) |
| `on(event, fn)` | Subscribe to events (`STATE_CHANGE`, `PLAYER_MOVE` ⚠️, `RESET` ⚠️). Returns `this` for chaining |
| `off(event, fn)` | Unsubscribe from events. **Requires the same function reference passed to `on()`** — store listeners in named variables, not inline arrow functions |
| `reset()` | Reset the game to initial state. Emits `STATE_CHANGE`; also emits deprecated `RESET` (removed in v2.0) |
| `getBoard()` | **Deprecated.** Use `board` instead. Will be removed in v2.0 |
| `savePlayerSelection(field: number)` | **Deprecated.** Use `savePlayerMove(index)` instead. Uses 1-9 field numbering; does not emit events. Will be removed in v2.0 |
| `isFieldSelected(field: number)` | **Deprecated.** Use `isFieldSelectedByIndex(index)` instead. Will be removed in v2.0 |

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

> ⚠️ **Deprecated events** — still emitted for backwards compatibility, will be removed in v2.0:
>
> ```typescript
> // PLAYER_MOVE — emitted only by savePlayerMove, includes the played index
> game.on(GameEvent.PLAYER_MOVE, ({ board, currentPlayer, gameStatus, index }) => { ... });
>
> // RESET — emitted only by reset()
> game.on(GameEvent.RESET, (payload) => { ... });
> ```

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
```
