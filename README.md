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

// Make a move (field 1-9)
game.savePlayerSelection(5);

// Check game status
console.log(game.gameStatus); // { status: 'running' } | { status: 'win', winner: 'O' } | { status: 'draw' }
console.log(game.currentPlayer); // 'O' or 'X'

// Check if field is already selected
console.log(game.isFieldSelected(5)); // true

// Access the board
console.log(game.getBoard()); // [1, 2, 3, 4, 'O', 6, 7, 8, 9]

// Reset the game
game.reset();
```

### API

#### `Game`

| Property/Method | Description                    |
| --------------- | ------------------------------ |
| `constructor()` | Create a new game with default symbols `['O', 'X']` |
| `currentPlayer` | Get the current player's symbol              |
| `gameStatus`    | Get current game status                      |
| `getBoard()`    | Returns the current board state as `(number \| PlayerSymbol)[]`       |
| `savePlayerSelection(field: number)` | Place current player's symbol on field 1-9   |
| `isFieldSelected(field: number)` | Check if a field is already occupied           |
| `reset()`       | Reset the game to initial state              |

## CLI Usage

Run the interactive console game:

```bash
npx tic-tac-toe-core
```

## Exports

```typescript
// Core class
export { Game } from 't3c';

// Constants
export { DEFAULT_GAME_SYMBOLS } from 't3c';

// Types
export type { IGame, GameStatus, PlayerSymbol, PlayerSymbols } from 't3c';
```
