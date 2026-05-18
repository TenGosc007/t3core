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
import { Game } from 't3core';

// Create a game with default symbols 'O' and 'X'
const game = new Game();

// Make a move (index 0-8)
game.savePlayerMove(4); // Places 'O' at center (index 4)

// Check game status
console.log(game.gameStatus); // { status: 'running' } | { status: 'win', winner: 'O' } | { status: 'draw' }
console.log(game.currentPlayer); // 'O' or 'X'

// Check if field is already selected
console.log(game.isFieldSelectedByIndex(4)); // true

// Access the board
console.log(game.board); // ['O', 2, 3, 4, 'X', 6, 7, 8, 9]

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
      game.on(GameEvent.PLAYER_MOVE, callback);
      game.on(GameEvent.RESET, callback);
      return () => {
        game.off(GameEvent.PLAYER_MOVE, callback);
        game.off(GameEvent.RESET, callback);
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
| `constructor(options?)` | Create a new game. `options.boardSize` sets board size (default: `9`) |
| `currentPlayer` | Get the current player's symbol |
| `gameStatus` | Get current game status |
| `board` | Get current board state as `BoardField[]` |
| `snapshot` | Stable snapshot for `useSyncExternalStore` (returns `GameEventPayload`) |
| `savePlayerMove(index: number)` | Place current player's symbol at index 0-8 |
| `isFieldSelectedByIndex(index: number)` | Check if a field is already occupied |
| `on(event, fn)` | Subscribe to events (`PLAYER_MOVE`, `RESET`). Returns `this` for chaining |
| `off(event, fn)` | Unsubscribe from events. **Requires the same function reference passed to `on()`** — store listeners in named variables, not inline arrow functions |
| `reset()` | Reset the game to initial state |
| `getBoard()` | **Deprecated.** Use `board` instead |
| `savePlayerSelection(field: number)` | **Deprecated.** Use `savePlayerMove(index)` instead |
| `isFieldSelected(field: number)` | **Deprecated.** Use `isFieldSelectedByIndex(index)` instead |

### Events

Subscribe to game events with typed payloads:

```typescript
import { Game, GameEvent } from 't3core';

const game = new Game();

// PLAYER_MOVE — includes full snapshot + move index
game.on(GameEvent.PLAYER_MOVE, ({ board, currentPlayer, gameStatus, index }) => {
  console.log(`Player moved at index ${index}`);
  console.log('New state:', { board, currentPlayer, gameStatus });
});

// RESET — optional payload with new state
game.on(GameEvent.RESET, (payload) => {
  console.log('Game reset:', payload?.gameStatus); // { status: 'running' }
});

// Remember to use named functions (not arrow functions) if you need to unsubscribe later
function onMove({ index }) {
  console.log('Move at', index);
}
game.on(GameEvent.PLAYER_MOVE, onMove);
game.off(GameEvent.PLAYER_MOVE, onMove); // works
```

## Exports

```typescript
// Core class
export { Game } from 't3core';

// Constants
export { DEFAULT_GAME_SYMBOLS } from 't3core';

// Types
export type { IGame, GameStatus, PlayerSymbol, PlayerSymbols } from 't3core';
export type { GameEventMap, GameEventPayload } from 't3core';
export type { BoardField, IBoard } from 't3core';
export type { PlayerMoveStatus } from 't3core';

// Events
export { GameEvent } from 't3core';
```
