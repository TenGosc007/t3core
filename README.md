# TIC-TAC-TOE-CORE (t3c)

A reusable TypeScript core library for Tic Tac Toe games with a built-in CLI.

## Installation

```bash
npm install t3c
```

## Usage as a Library

```typescript
import { Game } from 't3c';

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

### React Integration with `useSyncExternalStore`

```tsx
import { useSyncExternalStore } from 'react';
import { Game, GameEvent } from 't3c';

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

| Property/Method | Description                    |
| --------------- | ------------------------------ |
| `constructor()` | Create a new game with default symbols `['O', 'X']` |
| `currentPlayer` | Get the current player's symbol              |
| `gameStatus`    | Get current game status                      |
| `board`         | Get current board state as `(number \| PlayerSymbol)[]` |
| `snapshot`      | Stable snapshot for `useSyncExternalStore` (returns `GameEventPayload`) |
| `savePlayerMove(index: number)` | Place current player's symbol at index 0-8   |
| `isFieldSelectedByIndex(index: number)` | Check if a field is already occupied           |
| `on(event, fn)` | Subscribe to events (`PLAYER_MOVE`, `RESET`) |
| `off(event, fn)` | Unsubscribe from events                     |
| `reset()`       | Reset the game to initial state              |
| `getBoard()`    | **Deprecated.** Use `board` instead          |
| `savePlayerSelection(field: number)` | **Deprecated.** Use `savePlayerMove(index)` instead |
| `isFieldSelected(field: number)` | **Deprecated.** Use `isFieldSelectedByIndex(index)` instead |

## CLI Usage

Run the interactive console game:

```bash
npx t3core
```

## Exports

```typescript
// Core class
export { Game } from 't3c';

// Constants
export { DEFAULT_GAME_SYMBOLS } from 't3c';

// Types
export type { IGame, GameStatus, PlayerSymbol, PlayerSymbols } from 't3c';
export type { GameEventMap, GameEventPayload } from 't3c';
export type { PlayerMoveStatus } from 't3c';

// Events
export { GameEvent } from 't3c';
```
