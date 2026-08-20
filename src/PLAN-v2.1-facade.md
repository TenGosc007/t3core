# Plan v2.1 — Facade API + Random AI engine

Jeden punkt wejścia (`TicTacToe` facade) dla użytkownika biblioteki, z bogatymi opcjami konfiguracyjnymi (tryb gry, wariant, silnik AI, kto zaczyna). Wewnętrzna architektura z `t3core-implementation-plan.md` (`Game`, `MoveStrategy`, `SinglePlayerGame`, `PvPGame`, `AIGame`) pozostaje nienaruszona — facade ją składa, nie reimplementuje. Dodatkowo: wycofanie `AIPlayer` (niewydane, bez deprecation) oraz dodanie prostego silnika losowego `RandomStrategy`.

---

## 1. Cel

Z perspektywy użytkownika biblioteki tworzenie gry ma być **jednym wywołaniem konstruktora** z opcjami, a nie ręcznym składaniem kilku klas. Z perspektywy architektury wewnętrznej klasy domenowe (`Game`, `MoveStrategy`, sesje) zachowują pojedyncze odpowiedzialności i czyste zależności.

```text
Użytkownik (typowy)
    ↓
TicTacToe (facade)           ← jedyna klasa, którą tworzy
    ↓ deleguje do
GameSession (PvPGame | SinglePlayerGame | AIGame)
    ↓ używa
Game + MoveStrategy
```

Facade jest **cienki**: konstruktor tworzy i składa komponenty, metody delegują do sesji. Jeśli facade zaczyna zawierać logikę domenową — to sygnał że logika uciekła do złej warstwy.

---

## 2. Zakres

### 2.1 W scope (v2.1)

- **`TicTacToe` facade** — jedna klasa z discriminated union options, delegująca do wewnętrznej architektury sesji.
- **`MoveStrategy` interface** — `calculateMove(snapshot, context): Promise<number>`, asynchroniczne API (patrz §4).
- **`AlphaBetaStrategy`** — adapter istniejącego `alphaBeta` + `getBestMove` pod `MoveStrategy`. Konfiguracja trudności w konstruktorze.
- **`RandomStrategy`** — nowy, najprostszy silnik: losowy legalny ruch, bez poziomów trudności, bez analizy planszy.
- **`SinglePlayerGame`** — orkiestrator human-vs-AI (z `t3core-implementation-plan.md`).
- **`PvPGame`** — orkiestrator local 2-player (z `t3core-implementation-plan.md`).
- **`AIGame`** — orkiestrator AI-vs-AI (nowy; tani wariant `SinglePlayerGame` z dwiema strategiami — przydatne do benchmarków trudności).
- **`GameSession`** — wspólny interfejs sesji (jeśli nie prowadzi do sztucznych wyjątków — patrz §5).
- **Eventy sesji**: `move`, `ai-thinking`, `turn`, `finished` — rozszerzenie istniejącego mechanizmu eventów, nie równoległy emitter.
- **Wycofanie `AIPlayer`** — klasa niewydana, usuwamy całkowicie (bez deprecation). `getBestMove` zostaje jako funkcja-helper.
- Testy jednostkowe dla facade, strategii, sesji.

### 2.2 Poza scope (odroczone)

- Ranking/persistence — v2.5.0.
- Większe plansze (5x5+), MCTS — przyszłe wersje.
- Worker Threads / Web Workers dla AI — odczerpane w `t3core-implementation-plan.md` §"CPU-bound alpha-beta"; nie komplikować bez pomiarów.
- Rust/WASM port — adnotacja w §10.
- CLI integration — `t3core-cli` (osobne repo).

---

## 3. Public API — `TicTacToe` facade

### 3.1 Opcje (discriminated union na `mode`)

TypeScript automatycznie zawęża dostępne opcje w zależności od `mode`. Zapobiega opcjom-worek rosnącym w nieskończoność.

```ts
// --- Konfiguracja AI (wspólna dla wszystkich trybów z AI) ---
export type AIConfig = {
  /**
   * Silnik AI. Dziś:
   * - `'alphabeta'` — Alfa-Beta z poziomami trudności (default)
   * - `'random'` — losowy legalny ruch, bez trudności
   * Przyszłość: `'mcts'`, `'wasm'`.
   */
  engine?: 'alphabeta' | 'random';

  /** Poziom trudności (tylko dla `engine: 'alphabeta'`). Ignorowany przez `random`. */
  difficulty?: AIDifficulty;   // 'normal' | 'hard'

  /** Opcjonalny seed RNG dla reprodukowalności (testy, benchmarki). */
  seed?: number;
};

// --- Opcje bazowe (wszystkie tryby) ---
type BaseOptions = {
  /** Wariant gry. Dziś tylko `'classic-3x3'` (default). Przyszłość: `'5x5'`, itp. */
  variant?: GameVariant;

  /** Symbole graczy. Default `['O', 'X']` — `'O'` zaczyna (konwencja). */
  symbols?: PlayerSymbols;
};

// --- PvP ---
export type PvpOptions = BaseOptions & {
  mode: 'pvp';
};

// --- Single Player (human vs AI) ---
export type SinglePlayerOptions = BaseOptions & {
  mode: 'singleplayer';

  /**
   * Symbol gracza-ludzkiego. `'O'` = człowiek zaczyna (default), `'X'` = AI zaczyna.
   * Symbol implikuje kolejność — nie trzeba osobnego pola `startsFirst`.
   */
  humanSymbol?: PlayerSymbol;

  /** Konfiguracja AI. Default: `{ engine: 'alphabeta', difficulty: 'hard' }`. */
  ai?: AIConfig;
};

// --- AI vs AI (benchmarki, demo) ---
export type AivsAiOptions = BaseOptions & {
  mode: 'aivsai';

  /** Konfiguracja dla gracza 1 (symbol `symbols[0]`, zaczyna) i gracza 2. */
  aiPlayers: [AIConfig, AIConfig];
};

export type TicTacToeOptions = PvpOptions | SinglePlayerOptions | AivsAiOptions;
```

### 3.2 Klasa `TicTacToe`

```ts
export class TicTacToe {
  constructor(options: TicTacToeOptions);

  // --- Wspólne API (deleguje do sesji) ---
  playMove(index: number): Promise<PlayMoveResult>;
  reset(): void;
  on(event: GameSessionEvent['type'], handler: (payload: any) => void): this;
  off(event: GameSessionEvent['type'], handler: (payload: any) => void): this;

  // --- Read-only accessors (deleguje do Game) ---
  get board(): BoardSnapshot;
  get currentPlayer(): PlayerSymbol;
  get gameStatus(): GameStatus;
  get snapshot(): GameEventPayload;
  get movesCount(): number;
  get mode(): GameMode;
}
```

### 3.3 Przykłady użycia

```ts
// PvP — najprostsze
const game = new TicTacToe({ mode: 'pvp' });

// Single player, człowiek gra O (zaczyna), AI na hard
const game = new TicTacToe({
  mode: 'singleplayer',
  humanSymbol: 'O',
  ai: { engine: 'alphabeta', difficulty: 'hard' },
});

// Single player, AI zaczyna (człowiek gra X), losowy silnik
const game = new TicTacToe({
  mode: 'singleplayer',
  humanSymbol: 'X',
  ai: { engine: 'random' },
});

// AI vs AI — benchmark: hard vs normal
const game = new TicTacToe({
  mode: 'aivsai',
  aiPlayers: [{ engine: 'alphabeta', difficulty: 'hard' },
              { engine: 'alphabeta', difficulty: 'normal' }],
});

// Wszędzie ten sam interfejs:
await game.playMove(4);
game.on('move', ({ player, position }) => renderMove(player, position));
game.on('ai-thinking', () => spinner.start());
game.on('turn', ({ player }) => enableInput(player));
game.on('finished', (result) => renderResult(result));
game.reset();
```

### 3.4 Nowe exporty w `src/index.ts`

```ts
// Facade
export { TicTacToe } from "./facade/TicTacToe";
export type { TicTacToeOptions, PvpOptions, SinglePlayerOptions, AivsAiOptions, AIConfig } from "./facade/types";

// Sesje (zaawansowane — dla użytkowników którzy chcą kontrolę)
export { SinglePlayerGame } from "./sessions/SinglePlayerGame";
export { PvPGame } from "./sessions/PvPGame";
export { AIGame } from "./sessions/AIGame";
export type { GameSession, GameSessionEvent, PlayMoveResult } from "./sessions/types";

// Strategie AI (zaawansowane — własna orkiestracja)
export { AlphaBetaStrategy } from "./ai/AlphaBetaStrategy";
export { RandomStrategy } from "./ai/RandomStrategy";
export type { MoveStrategy, MoveContext } from "./ai/strategy.types";

// Istniejące (z v2.0)
export { getBestMove } from "./ai/getBestMove";
export { AIDifficulty } from "./ai/types";
export type { AIOptions, AIMoveResult } from "./ai/types";

// Usunięte z v2.0 → v2.1:
// export { AIPlayer } from "./ai/AIPlayer";  ← WYCOFANE (niewydane, bez deprecation)
```

---

## 4. `MoveStrategy` — interfejs strategii AI

```ts
/** Kontekst przekazywany strategii oprócz snapshotu planszy. */
export type MoveContext = {
  /** Symbol gracza, którego ruch strategia ma wybrać. */
  aiSymbol: PlayerSymbol;
  /** Symbol przeciwnika. */
  opponentSymbol: PlayerSymbol;
  /** Aktualny status gry z `Game.gameStatus`. */
  gameStatus: GameStatus;
};

/**
 * Strategia wyboru ruchu AI. Otrzymuje snapshot planszy i kontekst,
 * zwraca indeks ruchu (0-based). NIE modyfikuje `Game` — to rola sesji.
 *
 * API jest asynchroniczne (`Promise`) celowo — nawet jeśli obecne
 * implementacje są synchroniczne. Pozwala to na przyszłe użycie
 * Worker Threads / Web Workerów / WASM bez zmiany API sesji.
 */
export interface MoveStrategy {
  calculateMove(board: BoardSnapshot, context: MoveContext): Promise<number>;
}
```

### 4.1 `AlphaBetaStrategy`

Adapter istniejącego `alphaBeta` + `getBestMove` pod `MoveStrategy`. Trudność/symbole/seed są **konfiguracją instancji** (konstruktor), nie argumentem per-call.

```ts
export class AlphaBetaStrategy implements MoveStrategy {
  constructor(options: { difficulty?: AIDifficulty; seed?: number } = {});

  async calculateMove(board: BoardSnapshot, context: MoveContext): Promise<number> {
    // Deleguje do istniejącego getBestMove (lub bezpośrednio do alphaBeta).
    // Sync wewnątrz, zwraca Promise przez `async`.
  }
}
```

### 4.2 `RandomStrategy` — nowy, najprostszy silnik

```ts
export class RandomStrategy implements MoveStrategy {
  constructor(options: { seed?: number } = {});

  async calculateMove(board: BoardSnapshot, _context: MoveContext): Promise<number> {
    // 1. Zbierz indeksy pól nie-zajętych (typeof field !== 'string').
    // 2. Wybierz losowo (Math.random lub seeded RNG jeśli podano seed).
    // 3. Zwróć indeks.
    // Brak poziomów trudności. Brak analizy planszy. Brak blokowania.
    // Jedyna gwarancja: nie trafia na zajęte pole.
  }
}
```

Zalety `RandomStrategy`:

- Najprostszy możliwy przeciwnik — dobry do testów, demo, "rozgrzewki".
- Punkt odniesienia dla benchmarków trudności (hard vs random → winrate).
- Najczystsza implementacja `MoveStrategy` — referencyjna dla przyszłych strategii.
- Brak trudności = brak konfiguracji = najmniejsza powierzchnia API.

---

## 5. Sesje — orkiestracja

### 5.1 `GameSession` (wspólny interfejs — jeśli nie prowadzi do sztucznych wyjątków)

```ts
export interface GameSession {
  playMove(index: number): Promise<PlayMoveResult>;
  reset(): void;
  on(event: GameSessionEvent['type'], handler: (payload: any) => void): this;
  off(event: GameSessionEvent['type'], handler: (payload: any) => void): this;

  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
}

export type PlayMoveResult =
  | { status: 'success' }
  | { status: 'invalid_index' }
  | { status: 'already_selected' }
  | { status: 'game_not_running' };

export type GameSessionEvent =
  | { type: 'move'; player: PlayerSymbol; position: number }
  | { type: 'ai-thinking'; player: PlayerSymbol }
  | { type: 'turn'; player: PlayerSymbol }
  | { type: 'finished'; result: GameStatus };
```

`ai-thinking` jest emitowany tylko przez `SinglePlayerGame` i `AIGame`. `PvPGame` emituje `move`/`turn`/`finished`. Jeśli wspólny interfejs wymusi sztuczne wyjątki — rozdzielić na osobne typy (plan `t3core-implementation-plan.md` linia 198 zostawia to otwartym).

### 5.2 `PvPGame`

```ts
export class PvPGame implements GameSession {
  constructor(options: { game: Game; symbols?: PlayerSymbols });

  async playMove(index: number): Promise<PlayMoveResult> {
    // 1. game.savePlayerMove(index) → sprawdź status
    // 2. emit 'move' { player, position }
    // 3. jeśli gra się skończyła → emit 'finished'
    //    else → emit 'turn' { player: następny }
  }
}
```

### 5.3 `SinglePlayerGame`

```ts
export class SinglePlayerGame implements GameSession {
  constructor(options: {
    game: Game;
    strategy: MoveStrategy;
    humanSymbol: PlayerSymbol;
    aiSymbol: PlayerSymbol;
  });

  async playMove(index: number): Promise<PlayMoveResult> {
    // 1. Waliduj: jeśli currentPlayer !== humanSymbol → błąd (nie tura człowieka)
    // 2. game.savePlayerMove(index) → sprawdź status
    // 3. emit 'move' { player: humanSymbol, position }
    // 4. Jeśli gra się skończyła → emit 'finished', return
    // 5. emit 'ai-thinking' { player: aiSymbol }
    // 6. const aiMove = await strategy.calculateMove(game.board, context)
    // 7. game.savePlayerMove(aiMove) → sprawdź status
    // 8. emit 'move' { player: aiSymbol, position: aiMove }
    // 9. Jeśli gra się skończyła → emit 'finished'
    //    else → emit 'turn' { player: humanSymbol }
  }
}
```

Kluczowa zasada: **strategia AI nigdy nie modyfikuje `Game`** — tylko `SinglePlayerGame` woła `game.savePlayerMove(aiMove)`.

`playMove` rozwiązuje Promise **po ruchu AI** (pełna tura: człowiek + AI w jednym `await`), nie po ruchu człowieka. UI reaguje na stan pośredni przez eventy, nie przez `await`. Patrz §5.5.

### 5.4 `AIGame` — AI vs AI

```ts
export class AIGame implements GameSession {
  constructor(options: {
    game: Game;
    strategies: [MoveStrategy, MoveStrategy];  // [gracz1, gracz2]
    symbols: PlayerSymbols;
  });

  async playMove(index: number): Promise<PlayMoveResult> {
    // W trybie AI-vs-AI `playMove` zewnętrznego indeksu nie ma sensu.
    // Dwie opcje:
    //   (a) playMove() bez argumentu — sesja sama pędzi ruch aktualnego gracza przez jego strategię.
    //   (b) auto-play loop: metoda `run()` która gra do końca.
    // Rekomendacja: (a) playMove() bez arg + opcjonalnie run() dla pełnej gry.
  }
}
```

`AIGame` jest tani (~30 linii) bo to `SinglePlayerGame` z dwiema strategiami zamiast jednej + bez "tura człowieka". Przydatne do:

- Benchmarków trudności (1000 gier hard-vs-normal → winrate).
- Demo / testów regressji (AI vs AI na hard → zawsze remis na 3x3).

### 5.5 Semantyka `playMove` i eventów

#### Kiedy `playMove` rozwiązuje Promise

W single-player `await game.playMove(index)` rozwiązuje się **dopiero po ruchu AI** — jedno `await` = pełna tura (człowiek + AI). UI nie musi samodzielnie sekwencjonować "ruch człowieka → czekaj na AI → ruch AI". Eventy są emitowane **w trakcie** trwania `playMove`, zanim Promise się rozwiąże — to pozwala UI reagować na stan pośredni (spinner, ruch AI na planszy) bez blokowania na `await`.

W PvP `playMove` rozwiązuje się po pojedynczym ruchu (nie ma AI).

Wybór "po ruchu AI" zamiast "po ruchu człowieka" jest celowy:

- Na 3x3 AI jest błyskawiczne (mikrosekundy) — `await` i tak natychmiast gotowe.
- Na przyszłych dużych planszach (MCTS, WASM) `await` może trwać sekundy — UI i tak musi nasłuchiwać eventów, bo nie może polegać na `await`. Jednolite API od początku.
- Brak race conditions: po `await` gra jest zawsze w stabilnym stanie (tura człowieka lub koniec).

#### Kolejność eventów w single-player (gra trwa)

```text
move        { player: humanSymbol, position }    ← narysuj ruch człowieka
ai-thinking { player: aiSymbol }                 ← włącz spinner, zablokuj input
                                                    (emitowany ZANIM AI zacznie liczyć)
[AI liczy — spinner żyje]
move        { player: aiSymbol, position }       ← narysuj ruch AI na planszy
turn        { player: humanSymbol }              ← wyłącz spinner, odblokuj input
```

Jeśli gra kończy się po ruchu człowieka:

```text
move      { player: humanSymbol, position }
finished  { result: GameStatus }
```

Jeśli gra kończy się po ruchu AI:

```text
move        { player: humanSymbol, position }
ai-thinking { player: aiSymbol }
move        { player: aiSymbol, position }
finished    { result: GameStatus }
```

#### Znaczenie eventów

- **`move`** — jedyny mechanizm "ostatni ruch na planszy". Payload `{ player, position }` mówi wprost kto i gdzie. Nie trzeba porównywać snapshotów przed/po. Emitowany dla każdego ruchu (człowieka i AI), więc UI ma jeden handler rysujący wszystkie ruchy.
- **`ai-thinking`** — emitowany **zanim** AI zacznie liczyć, żeby UI zdążyło włączyć spinner zanim ewentualne synchroniczne CPU-bound zablokuje event loop. Na 3x3 spinner będzie subtelny; na przyszłych dużych planszach będzie realnie widoczny.
- **`turn`** — sygnał "teraz tura gracza X, odblokuj input". Wyłącza spinner.
- **`finished`** — koniec gry. Wyłącza spinner, blokuje input, pokazuje wynik.

#### Brak odpytywania (polling)

UI nie sprawdza `game.gameStatus` w pętli. Eventy pchają stan do UI. `playMove` + 4 handlery eventów = pełna integracja UI.

---

## 6. Eventy — rozszerzenie, nie zastąpienie

- `Game` nadal emituje tylko `STATE_CHANGE` (istniejący, stabilny).
- Sesje nasłuchują `STATE_CHANGE` z `Game` i tłumaczą na eventy sesji (`move`/`ai-thinking`/`turn`/`finished`).
- Sesje mają własny emitter (lub współdzielą z facade). Nie tworzymy równoległego systemu eventów na poziomie `Game`.
- `TicTacToe` facade deleguje `on`/`off` do emittera sesji.

---

## 7. Stan sesji single-player (oddzielny od `GameStatus`)

```ts
export type SinglePlayerSessionState =
  | { type: 'player-turn'; player: PlayerSymbol }
  | { type: 'ai-thinking'; player: PlayerSymbol }
  | { type: 'finished'; result: GameStatus };
```

Nie mieszać z `GameStatus` (running/win/draw). `GameStatus` to stan silnika; stan sesji to stan orkiestracji. Plan `t3core-implementation-plan.md` §"Stany" wyraźnie to rozdziela.

---

## 8. Wycofanie `AIPlayer`

- `AIPlayer` (src/ai/AIPlayer.ts) zostaje **usunięte całkowicie**.
- Klasa nie została wydana (v2.0 jeszcze nie opublikowane) → nie ma deprecation, nie ma compat layer.
- `getBestMove` (funkcja-helper) zostaje — przydatne dla zaawansowanych użytkowników i używane wewnętrznie przez `AlphaBetaStrategy`.
- `src/tests/ai/AIPlayer.test.ts` zostaje usunięte.
- Export `AIPlayer` z `src/index.ts` zostaje usunięty.
- Rola `AIPlayer` (auto-play + manual move) przejmowana przez `SinglePlayerGame` (przez facade).

---

## 9. Struktura plików (nowe + zmienione)

```text
src/
├── index.ts                              (zmienione — nowe exporty, usunięte AIPlayer)
│
├── facade/                               (nowy folder)
│   ├── TicTacToe.ts                      (nowy — facade)
│   ├── types.ts                          (nowy — TicTacToeOptions, AIConfig, itp.)
│   └── index.ts                          (nowy — internal barrel)
│
├── sessions/                             (nowy folder)
│   ├── types.ts                          (nowy — GameSession, GameSessionEvent, PlayMoveResult, SinglePlayerSessionState)
│   ├── PvPGame.ts                        (nowy)
│   ├── SinglePlayerGame.ts               (nowy)
│   ├── AIGame.ts                         (nowy)
│   └── index.ts                          (nowy — internal barrel)
│
├── ai/                                   (istniejący folder)
│   ├── types.ts                          (istnieje — bez zmian)
│   ├── alphaBeta.ts                      (istnieje — bez zmian)
│   ├── getBestMove.ts                    (istnieje — bez zmian, używane przez AlphaBetaStrategy)
│   ├── AIPlayer.ts                       (USUNIĘTE)
│   ├── strategy.types.ts                 (nowy — MoveStrategy, MoveContext)
│   ├── AlphaBetaStrategy.ts              (nowy — adapter getBestMove → MoveStrategy)
│   ├── RandomStrategy.ts                 (nowy — losowy legalny ruch)
│   └── index.ts                          (nowy — internal barrel)
│
├── game/                                 (istnieje — bez zmian)
├── strategies/                           (istnieje — bez zmian)
├── utils/                                (istnieje — bez zmian)
├── constants/                            (istnieje — bez zmian)
│
└── tests/
    ├── facade/                           (nowy folder)
    │   └── TicTacToe.test.ts             (nowy — wszystkie tryby przez facade)
    ├── sessions/                         (nowy folder)
    │   ├── PvPGame.test.ts               (nowy)
    │   ├── SinglePlayerGame.test.ts      (nowy — lifecycle, eventy, brak AI po błędnym ruchu)
    │   └── AIGame.test.ts                (nowy — AI vs AI, terminacja)
    ├── ai/                               (istniejący folder)
    │   ├── alphaBeta.test.ts             (istnieje — bez zmian)
    │   ├── getBestMove.test.ts           (istnieje — bez zmian)
    │   ├── AIPlayer.test.ts              (USUNIĘTE)
    │   ├── AlphaBetaStrategy.test.ts     (nowy — implementuje MoveStrategy, nie mutuje)
    │   └── RandomStrategy.test.ts        (nowy — legalny ruch, nie mutuje, losowość)
    └── ... (istniejące testy bez zmian)
```

### Zasady organizacji

1. **`facade/` i `sessions/` są równoległe do `game/`, `ai/`, `strategies/`** — każdy moduł to osobny folder z `index.ts`, zgodnie z istniejącą konwencją.
2. **`facade/` zależy od `sessions/` + `ai/` + `game/`** — najwyższa warstwa, tylko składa.
3. **`sessions/` zależy od `game/` + `ai/strategy.types`** — nie zależy od `facade/`.
4. **`ai/` nie zależy od `sessions/` ani `facade/`** — strategie są niezależne, sesje je wstrzykują.
5. **`game/` nie zależy od niczego wyżej** — czysty silnik, bez wiedzy o AI/trybach/sesjach.

---

## 10. Przyszłość: Rust + WebAssembly (adnotacja tylko)

`AIConfig.engine` jest extensible: dziś `'alphabeta'` | `'random'`, przyszłość `'mcts'`, `'wasm'`. Facade mapuje string na klasę strategii. To punkt rozszerzenia na większe plansze i Rust/WASM — bez zmiany API facade. Implementacja `alphaBeta` (czysta funkcja na `BoardField[]`) jest już zaprojektowana jako drop-in replacement dla WASM.

---

## 11. Kryteria ukończenia

1. `TicTacToe({ mode: 'pvp' })` tworzy działającą sesję PvP z jednolitym API.
2. `TicTacToe({ mode: 'singleplayer', ai: { engine: 'alphabeta', difficulty: 'hard' } })` tworzy sesję z AI, gdzie po ruchu człowieka AI automatycznie odpowiada.
3. `TicTacToe({ mode: 'singleplayer', ai: { engine: 'random' } })` używa silnika losowego.
4. `TicTacToe({ mode: 'aivsai', aiPlayers: [...] })` tworzy sesję AI-vs-AI.
5. `humanSymbol` kontroluje kto zaczyna (O = człowiek, X = AI).
6. Eventy `move`/`ai-thinking`/`turn`/`finished` są emitowane w poprawnej kolejności.
7. Niepoprawny ruch człowieka nie uruchamia AI.
8. AI nie wykonuje ruchu po zakończeniu gry.
9. `AIPlayer` jest usunięte; `getBestMove` zostaje.
10. `RandomStrategy` zwraca tylko legalne ruchy (nigdy na zajęte pole).
11. Wewnętrzne klasy (`Game`, `MoveStrategy`, sesje) pozostają publicznie eksportowane dla zaawansowanych użytkowników.
12. `Game` nie wie nic o AI, trybach, sesjach, facade — bez zmian w `game/`.
13. Testy pokrywają: facade (3 tryby), każdą sesję, każdą strategię, lifecycle single-player, eventy.
14. `yarn test`, `yarn ts:check`, `yarn lint`, `yarn build` przechodzą.

---

## 12. Relacja do istniejących planów

- **`PLAN-v2.0.md`** — warstwa AI (alpha-beta, getBestMove, trudność). **Zaimplementowane**, z wyjątkiem `AIPlayer` (wycofywane w v2.1). Pozostaje jako historyczny opis warstwy AI.
- **`t3core-implementation-plan.md`** — wewnętrzna architektura sesji (`Game`, `MoveStrategy`, `SinglePlayerGame`, `PvPGame`, eventy, stany). **Nadrzędny dla warstwy orkiestracji**. Ten plan (v2.1) dodaje facade na wierzchu i `RandomStrategy` obok `AlphaBetaStrategy`.
- **Ten plan (v2.1)** — facade + `RandomStrategy` + wycofanie `AIPlayer` + `AIGame`. Zależy od v2.0 (AI) i `t3core-implementation-plan.md` (sesje).

Kolejność implementacji: najpierw warstwa sesji z `t3core-implementation-plan.md` (Etap 1-6), potem `RandomStrategy` + `AlphaBetaStrategy` (Etap 2 rozszerzony), potem facade (Etap 7 rozszerzony z `GameFactory` → `TicTacToe`), potem `AIGame`, potem testy.
