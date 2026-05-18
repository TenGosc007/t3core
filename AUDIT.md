# Audyt architektury i kodu — `t3core`

> **Wersja pakietu:** 1.2.1 · **Data audytu:** 2026-05-18  
> **Zakres:** pełna analiza kodu biblioteki core, wzorców projektowych, typów, testów oraz rekomendacje refactoringu

---

## 1. Architektura ogólna

### Struktura pakietu

```
src/
  Board.ts
  Game.ts
  index.ts
  constants/
  types/
  utils/
```

> **CLI demo** zostało wydzielone do osobnego repozytorium: [t3core-cli](https://github.com/TenGosc007/t3core-cli) (`npx t3core-cli`)

**Mocne strony:**

- Logika gry żyje bezpośrednio w `src/` — `package.json` eksportuje tylko `dist/src/index.ts`.
- Plik `index.ts` jest dobrze zaprojektowany — eksportuje klasy, typy, enumy i stałe jako spójne public API.
- Pakiet działa jako CommonJS (`"type": "commonjs"`) z prawidłowym `exports` map.
- CLI wydzielone do osobnego pakietu `t3core-cli` — `t3core` jest teraz czystą biblioteką bez `bin`.

~~**Słabe strony:**~~
~~- Repozytorium jest jednocześnie pakietem npm i aplikacją CLI demo — brak monorepo lub wyraźnego rozdziału.~~  ✅ *Naprawione — CLI przeniesione do [t3core-cli](https://github.com/TenGosc007/t3core-cli)*
~~- `bin` w `package.json` eksponuje `dist/index.js` (CLI), co jest nieoczekiwane dla biblioteki.~~  ✅ *Naprawione — pole `bin` usunięte z `package.json`*

---

## 2. Klasa `Game`

### Mocne strony

- **Enkapsulacja** — wszystkie pola prywatne (`_board`, `_currentPlayer`, `_gameStatus`, `_symbols`, `_emitter`). Stan nie wycieka na zewnątrz.
- **Snapshot pattern** — `_snapshot` w `Game` i analogiczny w `Board` zapewniają stabilne referencje obiektów, co czyni klasę kompatybilną z `useSyncExternalStore` w React bez dodatkowych wrappery.
- **EventEmitter** z typowaną `GameEventMap` — słuchacze mają pełne bezpieczeństwo typów przez `on<K extends keyof GameEventMap>`.
- **Fluent API** — `on()` i `off()` zwracają `this`, umożliwiając chainowanie.
- **Wartości zwrotne z `savePlayerMove`** — zamiast wyjątków, metoda zwraca `PlayerMoveStatus`, co jest idiomatyczne dla gier.

### Słabe strony

#### 2.1 ~~Niespójność deprecated API~~ ✅

~~`savePlayerMove` wewnętrznie wywoływało `isFieldSelected(index + 1)`.~~ Naprawione — używa teraz `this.isFieldSelectedByIndex(index)`.

#### 2.2 ~~`console.warn` w bibliotece~~ ✅

~~`savePlayerMove` logowało do konsoli przy błędnym użyciu.~~ Naprawione — oba `console.warn` usunięte; zwracany `PlayerMoveStatus` jest wystarczający.

#### 2.3 Konfigurowalność symboli — świadoma decyzja

`_symbols` jest inicjalizowane stałą `DEFAULT_GAME_SYMBOLS` (`['O', 'X']`). Obsługa niestandardowych symboli po stronie biblioteki wymagałaby generyczności klasy (`Game<T extends string>`), co komplikuje system typów. Konsument może samodzielnie zbudować mapper symboli na warstwie aplikacji — biblioteka nie musi tego obsługiwać.

#### 2.4 ~~Brak payload w evencie `RESET`~~ ✅

Naprawione — `GameEventMap[RESET]` używa `[payload?: GameEventPayload]` (opcjonalny, bez breaking change). `reset()` emituje teraz `this._snapshot` jako argument.

#### 2.5 ~~`_updateGameStatus` nie czyści stanu "win"/"draw" przy reset~~ ✅

Naprawione — usunięto warunek `if (isNotRunning)`, `_updateGameStatus` zawsze ustawia `running` jako fallback. `reset()` teraz woła `_updateGameStatus()` zamiast ręcznie ustawiać status.

---

## 3. Klasa `Board`

### Mocne strony

- **Snapshot cache** z inwalidacją przy każdej mutacji (`_snapshot = null`) — eleganckie i wydajne.
- Czysta separacja: `Board` nie wie nic o `Game`, `Player` ani logice wygranej.
- `isFull()` jest czytelne i zwięzłe.

### Słabe strony

#### 3.1 ~~Interfejs `IBoard` nie zawiera nowych metod~~ ✅

Naprawione — `IBoard` zawiera teraz `getFieldByIndex` i `setFieldByIndex`. Stare metody oznaczone `@deprecated`.

#### 3.2 ~~Stały rozmiar planszy (9)~~ ✅

Naprawione — `Board` przyjmuje opcjonalny parametr `size` (domyślnie `9`). `Game` przyjmuje `options: GameOptions = {}` z polem `boardSize?: number`. `GameOptions` wyeksportowane z publicznego API.

---

## 4. System typów

### Mocne strony

- `GameStatus` jako discriminated union (`{ status: 'win', winner }` | `{ status: 'draw' }` | `{ status: 'running' }`) — poprawny i bezpieczny wzorzec TypeScript.
- `PlayerMoveStatus` jako `const` object + typ (`as const` + `typeof`) — idiomatyczne, działa i jako enum, i jako typ string literalowy.
- `GameEvent` analogicznie — spójność wzorca.
- `GameEventPayload` aggreguje pełny snapshot stanu — dobrze przemyślane.

### Słabe strony

#### 4.1 ~~`IGame` zawiera deprecated metody bez oznaczenia~~ ✅

Naprawione — `savePlayerSelection`, `isFieldSelected`, `getBoard` oznaczone `@deprecated` w `IGame`. Dodano brakujący getter `board`.

#### 4.2 ~~`EventEmit` niezgodny z fluent API~~ ✅

Naprawione — `EventEmit` jest teraz generyczny: `EventEmit<T>`, a `IGame` używa `EventEmit<this>` dla `on`/`off`. Return type poprawnie opisuje chainowanie.

#### 4.3 `PlayerSymbol` jest hardcoded do `'O' | 'X'` — świadoma decyzja

Typ pochodzi bezpośrednio z `DEFAULT_GAME_SYMBOLS as const`. Jest to ta sama kwestia co **2.3** — patrz tam po uzasadnienie.

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
      // callback has signature () => void - React calls getSnapshot() after each event
      game.on(GameEvent.PLAYER_MOVE, callback);
      game.on(GameEvent.RESET, callback);
      return () => {
        game.off(GameEvent.PLAYER_MOVE, callback);
        game.off(GameEvent.RESET, callback);
      };
    },
    () => game.snapshot,        // client snapshot
    () => game.snapshot,        // server snapshot (SSR)
  );

  return { state, game };
}

// For direct event usage (non-React), payload contains full state:
// game.on(GameEvent.PLAYER_MOVE, ({ board, currentPlayer, gameStatus, index }) => { ... })
// game.on(GameEvent.RESET, (payload) => { ... })
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
| **Singleton** | `gameSession.ts` (CLI, przeniesione do [t3core-cli](https://github.com/TenGosc007/t3core-cli)) | ℹ️ Poza zakresem tego repo |
| **Snapshot / Memento** | `Board._snapshot`, `Game._snapshot` | ✅ Eleganckie, wspiera React |
| **Facade** | `Game` nad `Board` | ✅ Ukrywa szczegóły implementacji planszy |

### Potencjalne ulepszenia

#### ~~Factory / Builder dla `Game`~~ ✅

Zaimplementowano konstruktor z opcjonalnym parametrem opcji `GameOptions`:

```typescript
const game = new Game();                  // domyślna plansza 9 pól
const game = new Game({ boardSize: 16 }); // plansza 4x4
```

`GameOptions` jest wyeksportowane z publicznego API. Symbole pozostają hardcoded — świadoma decyzja (patrz 2.3).

#### Command Pattern dla ruchów *(planowane v1.5)*

Obecne mutowalne `savePlayerMove` nie pozwala na cofanie ruchów (undo). Command pattern pozwoliłby na historię ruchów — przydatne dla AI lub replay. Zaplanowane do implementacji w wersji 1.5.

---

## 7. EventEmitter

### Ocena

- Wybór `eventemitter3` jest uzasadniony (lekka, typowana, zero zależności).
- Typowana `GameEventMap` to dobre podejście.

### ~~Problem: brak payload w `RESET`~~ ✅

Naprawione — `GameEventMap[RESET]` używa opcjonalnego payload:

```typescript
[GameEvent.RESET]: [payload?: GameEventPayload];
```

Spójność z `PLAYER_MOVE` zachowana. Payload opcjonalny — brak breaking change dla słuchaczy `() => void`.

### Ulepszenie: `EventEmit<T>` — generyczny return type ✅

`EventEmit` jest teraz generyczny:

```typescript
export type EventEmit<T> = <K extends keyof GameEventMap>(
  event: K,
  fn: (...args: GameEventMap[K]) => void,
) => T;
```

`IGame` używa `EventEmit<this>` dla `on`/`off` — return type poprawnie opisuje fluent API (chainowanie).

### ~~Problem: `off()` wymaga referencji do funkcji~~ ✅

Udokumentowane w README — ostrzeżenie o konieczności używania nazwanych funkcji (nie anonimowych strzałek) przy subskrypcji eventów.

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
| Ruch po zakończeniu gry | ✅ |
| Deprecated `savePlayerSelection` | ✅ |
| `isFieldSelected` vs `isFieldSelectedByIndex` | ✅ |
| Wielokrotny reset (reset → gra → reset) | ✅ |
| `off()` — usunięcie listenera | ✅ |

---

## 9. CLI — `t3core-cli`

Kod CLI (`src/ui/`, `src/app.ts`, `index.ts`) został przeniesiony do osobnego repozytorium: [https://github.com/TenGosc007/t3core-cli](https://github.com/TenGosc007/t3core-cli).

Poniższe obserwacje z pierwotnego audytu dotyczą teraz tamtego repo i powinny zostać tam zaadresowane:

- `gameSession.ts` używa Singleton z globalną zmienną modułową — utrudnia testowanie komponentów UI.
- `PlayerEntry.ts` używa deprecated `savePlayerSelection()` zamiast `savePlayerMove()`.
- `Board.ts` używa deprecated `getBoard()` zamiast `game.board`.

---

## 10. Rekomendacje

### 🔴 Krytyczne

| # | Problem | Zalecenie |
|---|---------|-----------|
| ~~C1~~ | ~~`savePlayerMove` wywołuje deprecated `isFieldSelected(index + 1)`~~ | ✅ Naprawione |
| ~~C2~~ | ~~`console.warn` w bibliotece~~ | ✅ Naprawione |
| ~~C3~~ | ~~`IBoard` nie opisuje nowych metod~~ | ✅ Naprawione |

### 🟡 Ważne

| # | Problem | Zalecenie |
|---|---------|-----------|
| ~~W1~~ | ~~Brak payload w evencie `RESET`~~ | ✅ Naprawione |
| ~~W2~~ | ~~`IGame` zawiera deprecated metody bez oznaczenia~~ | ✅ Naprawione |
| ~~W3~~ | ~~`EventEmit` deklaruje `void` — niezgodne z fluent API~~ | ✅ Naprawione |
| W4 | CLI używa deprecated API | Zaadresuj w repozytorium [t3core-cli](https://github.com/TenGosc007/t3core-cli) |
| ~~W5~~ | ~~Brak testów dla kluczowych edge cases~~ | ✅ Naprawione — wszystkie scenariusze z sekcji 8 pokryte (17 testów łącznie) |

### 🟢 Nice-to-have

| # | Problem | Zalecenie |
|---|---------|-----------|
| N1 | Konfiguracja symboli | Świadoma decyzja — konsument obsługuje mapping na warstwie aplikacji; generyczność klasy zbyt komplikuje typy |
| ~~N2~~ | ~~CLI bin w bibliotece~~ | ✅ *Naprawione — CLI wydzielone do [t3core-cli](https://github.com/TenGosc007/t3core-cli), `bin` usunięte* |
| N3 | `gameSession.ts` niemożliwy do testowania | Zaadresuj w [t3core-cli](https://github.com/TenGosc007/t3core-cli) |
| N4 | Brak historii ruchów | Rozważ Command pattern dla undo/replay |
| N5 | `PlayerSymbol` hardcoded | Świadoma decyzja — patrz N1 |

---

## 11. Podsumowanie

`t3core` to **dobrze zaprojektowana biblioteka core** dla gry tic-tac-toe. Główne zalety to czysta enkapsulacja, snapshot pattern wspierający React, typowane eventy i separacja logiki od UI.

**Wszystkie krytyczne problemy (C1-C3) oraz ważne problemy (W1-W3, W5) zostały naprawione.** Pozostałe: CLI używa deprecated API (W4) oraz singleton w CLI (N3) do zaadresowania w [t3core-cli](https://github.com/TenGosc007/t3core-cli). Historia ruchów (N4) zaplanowana na v1.5.

**Problem Next.js** nie wymaga przepisywania klasy — wystarczy używać `game.snapshot` jako prop i trzymać instancję `Game` w `useRef` lub Context po stronie klienta. `useSyncExternalStore` jest już natywnie wspierany przez istniejący design klasy.
