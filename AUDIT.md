# Audyt architektury i kodu — `t3core`

> **Wersja pakietu:** 1.1.4 · **Data audytu:** 2026-05-17  
> **Zakres:** pełna analiza kodu biblioteki core, wzorców projektowych, typów, testów oraz rekomendacje refactoringu

---

## 1. Architektura ogólna

### Struktura pakietu

```
src/
  core/          ← eksportowany pakiet npm (t3core)
    Board.ts
    Game.ts
    index.ts
    constants/
    types/
    utils/
  ui/            ← CLI demo (nie jest częścią pakietu)
    features/game/
    screens/
    ...
index.ts         ← entry-point CLI
```

**Mocne strony:**
- Czyste oddzielenie logiki gry (`core/`) od UI CLI (`ui/`) — `package.json` eksportuje tylko `dist/src/core/index.ts`.
- Plik `index.ts` jest dobrze zaprojektowany — eksportuje klasy, typy, enumy i stałe jako spójne public API.
- Pakiet działa jako CommonJS (`"type": "commonjs"`) z prawidłowym `exports` map.

**Słabe strony:**
- Repozytorium jest jednocześnie pakietem npm i aplikacją CLI demo — brak monorepo lub wyraźnego rozdziału (np. `examples/`). To może wprowadzać w błąd konsumentów pakietu.
- `bin` w `package.json` eksponuje `dist/index.js` (CLI), co jest nieoczekiwane dla biblioteki; konsument instalujący pakiet otrzymuje też zbędny bin.

---

## 2. Klasa `Game`

### Mocne strony

- **Enkapsulacja** — wszystkie pola prywatne (`_board`, `_currentPlayer`, `_gameStatus`, `_symbols`, `_emitter`). Stan nie wycieka na zewnątrz.
- **Snapshot pattern** — `_snapshot` w `Game` i analogiczny w `Board` zapewniają stabilne referencje obiektów, co czyni klasę kompatybilną z `useSyncExternalStore` w React bez dodatkowych wrappery.
- **EventEmitter** z typowaną `GameEventMap` — słuchacze mają pełne bezpieczeństwo typów przez `on<K extends keyof GameEventMap>`.
- **Fluent API** — `on()` i `off()` zwracają `this`, umożliwiając chainowanie.
- **Wartości zwrotne z `savePlayerMove`** — zamiast wyjątków, metoda zwraca `PlayerMoveStatus`, co jest idiomatyczne dla gier.

### Słabe strony

#### 2.1 Niespójność deprecated API

`savePlayerMove` (nowe API) wewnętrznie wywołuje `isFieldSelected(index + 1)` — czyli **deprecated metodę** opartą na numerowaniu 1-9, mimo że sama operuje na indeksach 0-8:

```typescript
// Game.ts:167
if (this.isFieldSelected(index + 1)) {  // ← wywołuje deprecated metodę
```

To jest **błąd logiczny / techniczny dług**. Powinno być `this.isFieldSelectedByIndex(index)`.

#### 2.2 `console.warn` w bibliotece

`savePlayerMove` loguje do konsoli (`console.warn`) w przypadku błędnego użycia. Biblioteka nie powinna pisać do `stdout/stderr` — konsument powinien sam zdecydować jak obsłużyć `PlayerMoveStatus.ALREADY_SELECTED`.

#### 2.3 Brak konfigurowalności symboli

`_symbols` jest inicjalizowane stałą `DEFAULT_GAME_SYMBOLS` i **nie można ich zmienić** — brak konstruktora przyjmującego opcje. Dodanie niestandardowych symboli (np. `['🐱', '🐶']`) jest niemożliwe bez fork-owania kodu.

#### 2.4 Brak payload w evencie `RESET`

```typescript
// types/Game.ts:32
[GameEvent.RESET]: [];  // ← brak GameEventPayload
```

Po `reset()` słuchacz musi osobno odczytać `game.snapshot`, zamiast otrzymać nowy stan jako argument callbacku. Niekonzystentne z `PLAYER_MOVE`.

#### 2.5 `_updateGameStatus` nie czyści stanu "win"/"draw" przy reset

Metoda `reset()` ustawia `_gameStatus` ręcznie — to działa, ale logika resetowania stanu jest duplikowana zamiast korzystać z `_updateGameStatus`.

---

## 3. Klasa `Board`

### Mocne strony

- **Snapshot cache** z inwalidacją przy każdej mutacji (`_snapshot = null`) — eleganckie i wydajne.
- Czysta separacja: `Board` nie wie nic o `Game`, `Player` ani logice wygranej.
- `isFull()` jest czytelne i zwięzłe.

### Słabe strony

#### 3.1 Interfejs `IBoard` nie zawiera nowych metod

```typescript
// types/Board.ts — brak:
getFieldByIndex, setFieldByIndex
```

`IBoard` jest niekompletny — opisuje tylko deprecated API (`getFieldByNumber`, `setFieldByNumber`). Klasa `Board` implementuje `IBoard`, ale nie jest to weryfikowalne przez interfejs dla nowych metod.

#### 3.2 Stały rozmiar planszy (9)

`BOARD_SIZE = 9` jest hardcoded. Choć tic-tac-toe zawsze ma planszę 3x3, dla biblioteki ogólnego przeznaczenia (potencjalnie różne warianty) brak konfigurowalności jest ograniczeniem.

---

## 4. System typów

### Mocne strony

- `GameStatus` jako discriminated union (`{ status: 'win', winner }` | `{ status: 'draw' }` | `{ status: 'running' }`) — poprawny i bezpieczny wzorzec TypeScript.
- `PlayerMoveStatus` jako `const` object + typ (`as const` + `typeof`) — idiomatyczne, działa i jako enum, i jako typ string literalowy.
- `GameEvent` analogicznie — spójność wzorca.
- `GameEventPayload` aggreguje pełny snapshot stanu — dobrze przemyślane.

### Słabe strony

#### 4.1 `IGame` zawiera deprecated metody w kontrakcie

```typescript
// types/Game.ts:46-48
savePlayerSelection: (field: number) => void;
isFieldSelected: (field: number) => boolean;
getBoard: () => BoardField[];
```

Interfejs publiczny pakietu nadal deklaruje deprecated metody jako część kontraktu. To utrudnia ich usunięcie w przyszłości i myli konsumentów.

#### 4.2 `EventEmit` nie jest używany jako typ `on`/`off` w `IGame`

```typescript
// types/Game.ts:35-38
export type EventEmit = <K extends keyof GameEventMap>(
  event: K,
  fn: (...args: GameEventMap[K]) => void,
) => void;

// ale w IGame:
on: EventEmit;   // ← brak zwracanego `this`
```

`EventEmit` deklaruje `void` return — tymczasem implementacja zwraca `this` (fluent). Interfejs nie opisuje poprawnie kontraktu fluent API.

#### 4.3 `PlayerSymbol` jest hardcoded do `'O' | 'X'`

Typ pochodzi bezpośrednio z `DEFAULT_GAME_SYMBOLS as const`. Nie ma możliwości stworzenia `Game` z innymi symbolami w sposób typesafe.

---

## 5. Problem Next.js — klasy przez propsy

### Przyczyna problemu

Next.js przy Server Components serializuje propsy do JSON (server → client boundary). **Instancje klas nie są serializowalne** — JSON nie zachowuje prototypów, metod ani prywatnych pól. Stąd błąd `Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components`.

### Wzorce rozwiązania

#### Wzorzec A: Plain State Object + fabryka (zalecane dla SSR)

Zamiast przekazywać instancję `Game` przez propsy, przekazuj tylko serializowalny snapshot stanu:

```typescript
// Zamiast: <GameBoard game={game} />
// Używaj:  <GameBoard state={game.snapshot} />

type GameSnapshot = {
  board: BoardField[];
  currentPlayer: PlayerSymbol;
  gameStatus: GameStatus;
};
```

Instancja `Game` żyje po stronie klienta (np. w `useRef` lub `useState`), a przez propsy przepływa tylko czysty obiekt stanu.

#### Wzorzec B: `useSyncExternalStore` (React 18+)

`Game` jest już przygotowany do tego wzorca (stabilne referencje `snapshot`)! Przykładowy hook:

```typescript
// useGame.ts (Client Component)
import { useSyncExternalStore } from 'react';
import { Game, GameEvent } from 't3core';

const game = new Game(); // singleton po stronie klienta

export function useGame() {
  const state = useSyncExternalStore(
    (callback) => {
      game.on(GameEvent.PLAYER_MOVE, callback);
      game.on(GameEvent.RESET, callback);
      return () => {
        game.off(GameEvent.PLAYER_MOVE, callback);
        game.off(GameEvent.RESET, callback);
      };
    },
    () => game.snapshot,
    () => game.snapshot, // server snapshot (SSR)
  );

  return { state, game };
}
```

`Game` ma `snapshot` z stabilnymi referencjami i EventEmitter — to **idealny external store** dla `useSyncExternalStore`.

#### Wzorzec C: Context API (dla mniejszych aplikacji)

```typescript
const GameContext = createContext<Game | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const game = useRef(new Game()).current;
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}
```

Instancja `Game` nie przechodzi przez propsy — żyje w kontekście po stronie klienta.

**Wniosek:** `Game` nie wymaga przepisywania. Problem Next.js to kwestia **warstwy konsumenckiej** — instancja powinna żyć w `useRef`/Context po stronie klienta, a przez propsy przekazywać `game.snapshot`.

---

## 6. Wzorce projektowe

### Aktualnie użyte

| Wzorzec | Gdzie | Ocena |
|---------|-------|-------|
| **Observer** (EventEmitter) | `Game._emitter` | ✅ Dobrze dopasowany, typowany |
| **Singleton** | `gameSession.ts` (CLI) | ⚠️ Poprawny dla CLI, ale globalny stan utrudnia testowanie |
| **Snapshot / Memento** | `Board._snapshot`, `Game._snapshot` | ✅ Eleganckie, wspiera React |
| **Facade** | `Game` nad `Board` | ✅ Ukrywa szczegóły implementacji planszy |

### Potencjalne ulepszenia

#### Factory / Builder dla `Game`

Brak możliwości konfiguracji gry (symbole, rozmiar) sugeruje potrzebę fabryki:

```typescript
// Propozycja
const game = Game.create({ symbols: ['🐱', '🐶'] });
// lub
const game = new GameBuilder().withSymbols(['A', 'B']).build();
```

Alternatywnie wystarczy konstruktor z opcjonalnym parametrem opcji.

#### Command Pattern dla ruchów

Obecne mutowalne `savePlayerMove` nie pozwala na cofanie ruchów (undo). Command pattern pozwoliłby na historię ruchów — przydatne dla AI lub replay.

---

## 7. EventEmitter

### Ocena

- Wybór `eventemitter3` jest uzasadniony (lekka, typowana, zero zależności).
- Typowana `GameEventMap` to dobre podejście.

### Problem: brak payload w `RESET`

```typescript
[GameEvent.RESET]: [];  // słuchacz nie otrzymuje nowego stanu
```

Powinno być:
```typescript
[GameEvent.RESET]: [payload: GameEventPayload];
```

Spójność z `PLAYER_MOVE` i użyteczność dla `useSyncExternalStore`.

### Problem: `off()` wymaga referencji do funkcji

Standardowy problem z EventEmitter — anonimowe funkcje strzałkowe nie mogą być usunięte. Warto to zaznaczyć w dokumentacji.

---

## 8. Testy

### Pokrycie

| Scenariusz | Pokryty |
|------------|---------|
| Remis | ✅ |
| Wygrana | ✅ |
| Reset | ✅ |
| `PLAYER_MOVE` event | ✅ |
| `RESET` event | ✅ |
| Zablokowanie ruchu na zajętym polu | ✅ |
| Ruch po zakończeniu gry | ❌ |
| Deprecated `savePlayerSelection` | ❌ |
| `isFieldSelected` vs `isFieldSelectedByIndex` | ❌ |
| Wielokrotny reset (reset → gra → reset) | ❌ |
| `off()` — usunięcie listenera | ❌ |

### Brakujące testy (krytyczne)

```typescript
test("savePlayerMove returns GAME_NOT_RUNNING after win", () => {
  const game = new Game();
  // ... doprowadź do wygranej
  const result = game.savePlayerMove(8);
  expect(result).toBe(PlayerMoveStatus.GAME_NOT_RUNNING);
});

test("off() removes listener", () => {
  const game = new Game();
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);
  game.off(GameEvent.PLAYER_MOVE, listener);
  game.savePlayerMove(0);
  expect(listener).not.toHaveBeenCalled();
});
```

---

## 9. CLI — użycie w `ui/`

### `gameSession.ts` — Singleton

```typescript
let game: Game | null = null;

export const getGame = () => {
  if (!game) game = createNewGame();
  return game;
};
```

**Dla CLI to akceptowalne** — jeden proces, jeden stan gry. Jednak:
- Globalna zmienna modułowa utrudnia testowanie komponentów UI (brak możliwości wstrzyknięcia mocka).
- Brak metody `destroyGame()` — reset gry woła `getGame().reset()`, ale instancja żyje dalej w module.

### `PlayerEntry` używa deprecated API

```typescript
// PlayerEntry.ts:33
game.savePlayerSelection(answer);  // ← deprecated
```

Powinno używać `savePlayerMove`.

### `Board.ts` używa deprecated API

```typescript
// Board.ts:11
const fields = game.getBoard();  // ← deprecated, zamiast game.board
```

---

## 10. Rekomendacje

### 🔴 Krytyczne

| # | Problem | Zalecenie |
|---|---------|-----------|
| C1 | `savePlayerMove` wywołuje deprecated `isFieldSelected(index + 1)` | Zamień na `this.isFieldSelectedByIndex(index)` |
| C2 | `console.warn` w bibliotece | Usuń — zwracany `PlayerMoveStatus` wystarczy |
| C3 | `IBoard` nie opisuje nowych metod | Dodaj `getFieldByIndex`, `setFieldByIndex` do interfejsu |

### 🟡 Ważne

| # | Problem | Zalecenie |
|---|---------|-----------|
| W1 | Brak payload w evencie `RESET` | Dodaj `GameEventPayload` do `GameEventMap[RESET]` |
| W2 | `IGame` zawiera deprecated metody | Oznacz je `@deprecated` w interfejsie lub usuń z kontraktu |
| W3 | `EventEmit` deklaruje `void` — niezgodne z fluent API | Popraw typ lub usuń `EventEmit` na rzecz inline generics |
| W4 | CLI używa deprecated API | Zaktualizuj `PlayerEntry` i `Board.ts` CLI do nowego API |
| W5 | Brak testów dla kluczowych edge cases | Dodaj brakujące scenariusze z sekcji 8 |

### 🟢 Nice-to-have

| # | Problem | Zalecenie |
|---|---------|-----------|
| N1 | Brak konfigurowalnych symboli | Dodaj opcjonalny parametr konstruktora `options: { symbols?: PlayerSymbols }` |
| N2 | CLI bin w bibliotece | Przenieś CLI do `examples/` lub osobnego pakietu |
| N3 | `gameSession.ts` niemożliwy do testowania | Dodaj możliwość wstrzyknięcia instancji `Game` |
| N4 | Brak historii ruchów | Rozważ Command pattern dla undo/replay |
| N5 | `PlayerSymbol` hardcoded | Uczyń generycznym: `Game<T extends string = 'O' | 'X'>` |

---

## 11. Podsumowanie

`t3core` to **dobrze zaprojektowana biblioteka core** dla gry tic-tac-toe. Główne zalety to czysta enkapsulacja, snapshot pattern wspierający React, typowane eventy i separacja logiki od UI.

**Kluczowe problemy** to: błąd w `savePlayerMove` wywołującym deprecated metodę (C1), `console.warn` w bibliotece (C2), niekompletny `IBoard` (C3) oraz niespójności deprecated API w interfejsach i użyciu CLI.

**Problem Next.js** nie wymaga przepisywania klasy — wystarczy używać `game.snapshot` jako prop i trzymać instancję `Game` w `useRef` lub Context po stronie klienta. `useSyncExternalStore` jest już natywnie wspierany przez istniejący design klasy.
