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
GameSession (PvPGame | SinglePlayerGame)  +  AIGame (osobny interfejs)
    ↓ używa
Game + MoveStrategy
```

Facade jest **cienki**: konstruktor tworzy i składa komponenty, metody delegują do sesji. Jeśli facade zaczyna zawierać logikę domenową — to sygnał że logika uciekła do złej warstwy.

---

## 2. Zakres

### 2.1 W scope (v2.1)

- **`TicTacToe` facade** — jedna klasa z discriminated union options, delegująca do wewnętrznej architektury sesji.
- **`MoveStrategy` interface** — `calculateMove(snapshot, context): Promise<number>`, asynchroniczne API (patrz §4).
- **`AlphaBetaStrategy`** — implementacja `MoveStrategy` używająca `alphaBeta` bezpośrednio (nie `getBestMove`). Konfiguracja trudności w konstruktorze, persistent RNG.
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

  // UWAGA: Symbole graczy ('O', 'X') nie są konfigurowalne.
  // `Game` używa na stałe `DEFAULT_GAME_SYMBOLS` = `['O', 'X']` ('O' zaczyna).
  // Dodanie opcji `symbols` wymagałoby zmian w `game/` (Game, Board, strategie),
  // co łamałoby zasadę "bez zmian w game/". Konwencja kółko-krzyżyk jest powszechna
  // i nie ma uzasadnienia dla konfiguracji symboli w tej bibliotece.
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

  /** Konfiguracja dla gracza 1 ('O', zaczyna) i gracza 2 ('X'). */
  aiPlayers: [AIConfig, AIConfig];
};

export type TicTacToeOptions = PvpOptions | SinglePlayerOptions | AivsAiOptions;
```

### 3.2 `TicTacToe` — typowane construct signatures per tryb

TypeScript nie pozwala klasie deklarować różnych typów zwrotnych konstruktora. Dlatego publiczny symbol `TicTacToe` jest wartością konstrukcyjną opisaną przez **przeciążone construct signatures**, a implementację stanowi nieeksportowana klasa `TicTacToeImpl`. Dzięki temu zachowujemy składnię `new TicTacToe(...)`, a typ instancji zależy od `mode`: PvP nie ma `.step()`/`.run()`, zaś AI-vs-AI nie ma `.playMove()`/`.start()`.

```ts
// --- Instancje per tryb (zwracane przez overloads) ---

/** PvP — playMove + start + reset + eventy. Brak step/run. */
export interface PvPInstance {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  reset(): void;
  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
  readonly mode: 'pvp';
}

/** Single Player — playMove + start + reset + eventy. Brak step/run. */
export interface SinglePlayerInstance {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  reset(): void;
  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
  readonly mode: 'singleplayer';
}

/** AI vs AI — step + run + reset + eventy. Brak playMove/start. */
export interface AivsAiInstance {
  step(): Promise<PlayMoveResult>;
  run(): Promise<RunResult>;
  reset(): void;
  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
  readonly mode: 'aivsai';
}

// --- Publiczna wartość konstrukcyjna z overloads ---
export interface TicTacToeConstructor {
  new (options: PvpOptions): PvPInstance;
  new (options: SinglePlayerOptions): SinglePlayerInstance;
  new (options: AivsAiOptions): AivsAiInstance;
}

class TicTacToeImpl {
  constructor(options: TicTacToeOptions) {
    // Tworzy właściwą sesję i deleguje do niej API.
  }
}

export const TicTacToe: TicTacToeConstructor =
  TicTacToeImpl as unknown as TicTacToeConstructor;
```

TypeScript zawęża typ na podstawie literału `mode` w opcjach:

```ts
const pvp = new TicTacToe({ mode: 'pvp' });
pvp.playMove(4);   // ✅
pvp.step();        // ❌ Property 'step' does not exist on type 'PvPInstance'
pvp.run();         // ❌

const ai = new TicTacToe({ mode: 'aivsai', aiPlayers: [...] });
ai.step();         // ✅
ai.run();          // ✅
ai.playMove(4);    // ❌ Property 'playMove' does not exist on type 'AivsAiInstance'
ai.start();        // ❌
```

Runtime: fasada deleguje do odpowiedniej sesji. Wywołanie metody niewłaściwej dla trybu (jeśli ktoś obejście typowanie) rzuca `Error('Method not available in this mode')`.

### 3.3 Przykłady użycia

```ts
// PvP — najprostsze
const pvp = new TicTacToe({ mode: 'pvp' });
await pvp.start();
await pvp.playMove(4);

// Single player, człowiek gra O (zaczyna), AI na hard
const single = new TicTacToe({
  mode: 'singleplayer',
  humanSymbol: 'O',
  ai: { engine: 'alphabeta', difficulty: 'hard' },
});

// Single player, AI zaczyna (człowiek gra X), losowy silnik
const randomSingle = new TicTacToe({
  mode: 'singleplayer',
  humanSymbol: 'X',
  ai: { engine: 'random' },
});

// AI vs AI — benchmark: hard vs normal
const benchmark = new TicTacToe({
  mode: 'aivsai',
  aiPlayers: [{ engine: 'alphabeta', difficulty: 'hard' },
              { engine: 'alphabeta', difficulty: 'normal' }],
});

// AI vs AI nie ma playMove() — użyj step() lub run():
await benchmark.run();          // gra do końca, emituje move/turn/finished
// lub krok po kroku:
// await benchmark.step();      // jeden ruch aktualnego gracza AI

// Integracja single-player:
single.on('move', ({ player, position }) => renderMove(player, position));
single.on('ai-thinking', () => spinner.start());
single.on('turn', ({ player }) => enableInput(player));
single.on('finished', ({ result }) => renderResult(result));

await single.start();            // ← RAZ po on() — triggeruje AI jeśli AI zaczyna
await single.playMove(4);
// ...
single.reset();
await single.start();            // ← ponownie po resecie (jeśli AI zaczyna)
```

### 3.4 Nowe exporty w `src/index.ts`

```ts
// Facade
export { TicTacToe } from "./facade/TicTacToe";
export type { TicTacToeOptions, PvpOptions, SinglePlayerOptions, AivsAiOptions, AIConfig, PvPInstance, SinglePlayerInstance, AivsAiInstance, TicTacToeConstructor } from "./facade/types";

// Sesje (zaawansowane — dla użytkowników którzy chcą kontrolę)
export { SinglePlayerGame } from "./sessions/SinglePlayerGame";
export { PvPGame } from "./sessions/PvPGame";
export { AIGame } from "./sessions/AIGame";
export type { GameSession, GameSessionEvent, GameSessionEventType, GameSessionEventPayload, PlayMoveResult, StartResult, RunResult } from "./sessions/types";

// Strategie AI (zaawansowane — własna orkiestracja)
export { AlphaBetaStrategy } from "./ai/AlphaBetaStrategy";
export { RandomStrategy } from "./ai/RandomStrategy";
export type { MoveStrategy, MoveContext } from "./ai/strategy.types";
export { MoveStrategyError } from "./ai/strategy.types";

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
 *
 * Kontrakt:
 * - Jeśli są legalne ruchy → zwraca indeks legalnego pola (0-based).
 * - Jeśli brak legalnych ruchów (plansza pełna) → rzuca `MoveStrategyError('no_legal_moves')`.
 * - Zwrócony indeks MUSI być legalny (niezajęte pole, w zakresie planszy).
 *   Sesja waliduje wynik defensywnie — jeśli strategia zwróci nielegalny ruch,
 *   sesja rzuca `MoveStrategyError('illegal_move')` i nie aplikuje go.
 *   To chroni przed błędnymi/customowymi strategiami.
 * - Strategia NIE modyfikuje `board` (snapshot jest readonly).
 */
export interface MoveStrategy {
  calculateMove(board: BoardSnapshot, context: MoveContext): Promise<number>;
}

/** Błąd strategii — brak legalnych ruchów lub nielegalny wynik. */
export class MoveStrategyError extends Error {
  constructor(
    public readonly code: 'no_legal_moves' | 'illegal_move',
    message: string,
  ) {
    super(message);
    this.name = 'MoveStrategyError';
  }
}
```

### 4.1 `AlphaBetaStrategy`

**Nie deleguje do `getBestMove`** — `getBestMove` przyjmuje `IGame` (cały obiekt gry), a strategia dostaje tylko `BoardSnapshot` + `MoveContext`. Zamiast tego `AlphaBetaStrategy` używa `alphaBeta` bezpośrednio + współdzieloną konfigurację trudności.

`DIFFICULTY_CONFIG` (obecnie prywatna w `getBestMove.ts`) zostaje wyeksportowana do współdzielonego modułu (np. `ai/difficultyConfig.ts`), żeby `getBestMove` i `AlphaBetaStrategy` używały tego samego źródła prawdy. `getBestMove` zostaje jako convenience helper dla użytkowników z `IGame` — nie jest używane wewnętrznie przez strategię.

```ts
export class AlphaBetaStrategy implements MoveStrategy {
  private readonly _difficulty: AIDifficulty;
  private readonly _rng: () => number;  // PERSISTENT — tworzone raz w konstruktorze

  constructor(options: { difficulty?: AIDifficulty; seed?: number } = {}) {
    this._difficulty = options.difficulty ?? AIDifficulty.HARD;
    // RNG jest tworzone RAZ w konstruktorze i utrzymuje stan między wywołaniami.
    // To kluczowa różnica vs getBestMove (które tworzy RNG od nowa per call).
    // Persistent RNG zapewnia różnorodność ruchów w kolejnych turach
    // nawet z tym samym seedem — sekwencja losowa jest kontynuowana.
    this._rng = options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  }

  async calculateMove(board: BoardSnapshot, context: MoveContext): Promise<number> {
    // 1. Zbierz legalne indeksy (typeof field !== 'string').
    // 2. Jeśli brak legalnych → rzuć MoveStrategyError('no_legal_moves').
    // 3. Jeśli rng() < mistakeRate → zwróć losowy legalny ruch.
    // 4. Dla każdego legalnego ruchu: alphaBeta({ fields: [...board], ... }).
    // 5. Wybierz najlepszy wynik; tie-break przez move order (hard) lub rng (normal).
    // Sync wewnątrz, zwraca Promise przez `async`.
  }
}
```

**Różnica RNG vs `getBestMove`:** `getBestMove` tworzy `mulberry32(seed)` od nowa przy każdym wywołaniu — ten sam seed daje ten sam ruch za każdym razem. `AlphaBetaStrategy` tworzy RNG raz w konstruktorze — ten sam seed daje **różną sekwencję** ruchów w kolejnych turach (bo generator kontynuuje stan). To właściwe dla instancyjnej strategii: jedna gra = jedna sekwencja RNG, reprodukowalna przez seed.

### 4.2 `RandomStrategy` — nowy, najprostszy silnik

```ts
export class RandomStrategy implements MoveStrategy {
  private readonly _rng: () => number;

  constructor(options: { seed?: number } = {}) {
    // Generator powstaje raz na instancję, więc seed daje trwałą,
    // reprodukowalną sekwencję kolejnych ruchów.
    this._rng = options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  }

  async calculateMove(board: BoardSnapshot, _context: MoveContext): Promise<number> {
    // 1. Zbierz indeksy pól nie-zajętych (typeof field !== 'string').
    // 2. Jeśli lista jest pusta, rzuć MoveStrategyError('no_legal_moves').
    // 3. Wybierz indeks przez persistent _rng i zwróć go.
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
  /**
   * Inicjuje grę. Wywoływane RAZ po rejestracji listenerów (`on`).
   * - PvP: emituje `turn` dla gracza 1 ('O').
   * - Single Player, człowiek zaczyna: emituje `turn` dla człowieka.
   * - Single Player, AI zaczyna: emituje `ai-thinking`, wykonuje ruch AI,
   *   potem emituje `turn` dla człowieka (lub `finished` jeśli AI wygrało).
   * Konstruktor NIE wykonuje ruchów — jest sync i nie może bezpiecznie
   * uruchomić async AI zanim UI zarejestruje listenery. `start()` rozwiązuje
   * to: UI woła `on()` po konstruktorze, potem `await start()`.
   */
  start(): Promise<StartResult>;

  playMove(index: number): Promise<PlayMoveResult>;
  reset(): void;
  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;

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
  | { status: 'game_not_running' }
  | { status: 'busy' }        // playMove wywołane podczas trwania innego playMove
  | { status: 'aborted' };    // playMove przerwane przez reset() podczas obliczeń AI

export type StartResult =
  | { status: 'success' }
  | { status: 'busy' }
  | { status: 'aborted' };

export type RunResult =
  | { status: 'completed'; result: GameStatus }
  | { status: 'busy' }
  | { status: 'aborted' };

export type GameSessionEvent =
  | { type: 'move'; player: PlayerSymbol; position: number }
  | { type: 'ai-thinking'; player: PlayerSymbol }
  | { type: 'turn'; player: PlayerSymbol }
  | { type: 'finished'; result: GameStatus };

/** Typ eventu — używany jako klucz w `on`/`off` dla typowania. */
export type GameSessionEventType = GameSessionEvent['type'];

/** Mapa typu eventu → jego payload (bez pola `type`). Używana przez `on`/`off`.
 *  `Omit` usuwa `type` — handler dostaje np. `{ player, position }` dla `move`,
 *  nie `{ type: 'move', player, position }`. */
export type GameSessionEventPayload<K extends GameSessionEventType> = Omit<
  Extract<GameSessionEvent, { type: K }>,
  'type'
>;
```

`ai-thinking` jest emitowany tylko przez `SinglePlayerGame` i `AIGame`. `PvPGame` emituje `move`/`turn`/`finished`. Jeśli wspólny interfejs wymusi sztuczne wyjątki — rozdzielić na osobne typy (plan `t3core-implementation-plan.md` linia 198 zostawia to otwartym).

### 5.2 `PvPGame`

```ts
export class PvPGame implements GameSession {
  constructor(options: { game: Game });

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
    // 0. Jeśli _busyGeneration !== null → return { status: 'busy' }
    // 0a. Jeśli _lifecycle !== 'started' → return { status: 'game_not_running' }
    // 1. PRZED pierwszą mutacją/eventem: const gen = _generation; _busyGeneration = gen
    //    (listener eventu może synchronicznie/reentrantnie wywołać playMove())
    // 2. try {
    //      Waliduj: jeśli currentPlayer !== humanSymbol → błąd (nie tura człowieka)
    //      game.savePlayerMove(index) → sprawdź status
    //      emit 'move' { player: humanSymbol, position }
    //      Jeśli gra się skończyła → _lifecycle = 'finished'; emit 'finished', return
    //      emit 'ai-thinking' { player: aiSymbol }
    //      const aiMove = await strategy.calculateMove(game.board, context)
    //      // NAJPIERW generacja, POTEM walidacja wyniku:
    //      if (_generation !== gen) return { status: 'aborted' }
    //      if (!isLegalMove(aiMove, game.board)) throw MoveStrategyError('illegal_move')
    //      game.savePlayerMove(aiMove) → sprawdź status
    //      emit 'move' { player: aiSymbol, position: aiMove }
    //      Jeśli gra się skończyła → _lifecycle = 'finished'; emit 'finished'
    //      else → emit 'turn' { player: humanSymbol }
    //    } catch (e) {
    //      // Reset ma pierwszeństwo także wtedy, gdy Promise strategii został odrzucony:
    //      if (_generation !== gen) return { status: 'aborted' }
    //      rethrow — sesja sprawdziła stan terminalny przed uruchomieniem strategii,
    //      więc no_legal_moves w stanie running oznacza naruszenie kontraktu strategii
    //    } finally {
    //      if (_busyGeneration === gen) _busyGeneration = null  // tylko nasza generacja
    //    }
  }
}
```

Kluczowa zasada: **strategia AI nigdy nie modyfikuje `Game`** — tylko `SinglePlayerGame` woła `game.savePlayerMove(aiMove)`.

`playMove` rozwiązuje Promise **po ruchu AI** (pełna tura: człowiek + AI w jednym `await`), nie po ruchu człowieka. UI reaguje na stan pośredni przez eventy, nie przez `await`. Patrz §5.5.

### 5.4 `AIGame` — AI vs AI

`AIGame` **nie implementuje `GameSession`** — AI-vs-AI nie ma ludzkiego inputu, więc `playMove(index)` nie ma sensu. Zamiast tego ma `step()` (jeden ruch AI) i `run()` (gra do końca).

```ts
export class AIGame {
  constructor(options: {
    game: Game;
    strategies: [MoveStrategy, MoveStrategy];  // [gracz1='O', gracz2='X']
  });

  /** Wykonuje jeden ruch aktualnego gracza AI. Zwraca status ruchu. */
  async step(): Promise<PlayMoveResult>;

  /** Auto-gra do końca. Emituje eventy `move`/`turn` dla każdego ruchu, `finished` na końcu. */
  async run(): Promise<RunResult>;

  /**
   * Prywatny krok bez przejmowania locka. `step()` i `run()` przejmują lock
   * dokładnie raz, a następnie delegują tutaj z własnym numerem generacji.
   */
  private _performStep(gen: number): Promise<PlayMoveResult>;

  reset(): void;
  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this;

  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
}
```

`AIGame` nie ma `start()` — `step()` lub `run()` same inicjują grę (pierwsze wywołanie = pierwszy ruch gracza 1). Obie metody przejmują lock tylko raz. `run()` wykonuje pętlę przez prywatne `_performStep(gen)`, a nie przez publiczne `step()`, dzięki czemu nie blokuje samo siebie statusem `busy`. `reset()` czyści stan; ponowne `step()`/`run()` po resecie startuje nową grę.

`AIGame` jest tani (~40 linii) bo to `SinglePlayerGame` z dwiema strategiami zamiast jednej + bez "tura człowieka". Przydatne do:

- Benchmarków trudności (1000 gier hard-vs-normal → winrate przez `run()`).
- Demo / testów regressji (AI vs AI, obserwacja przez `step()`).

> **Uwaga:** "AI vs AI na hard → zawsze remis" jest **nieprawdziwe** dla obecnej konfiguracji. Poziom `hard` ma 10% losowych błędów i ograniczoną głębokość (4), więc hard-vs-hard może dać wygraną jednej ze stron. Tylko pełna głębokość Alfa-Beta (bez błędów) gwarantuje remis na 3x3 — ale taki poziom nie jest obecnie oferowany (byłby niepokonalny = bez sensu dla single-player). Benchmarki hard-vs-hard pokazują rozkład wyników przy obecnych parametrach, nie gwarantowany remis.

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

#### `reset()` i `lastMove`

`reset()` **nie emituje eventów sesji** — jest operacją inicjowaną przez UI, więc UI wie że musi wyczyścić swój stan (w tym `lastMove`). To celowe: `reset` to akcja UI, nie przejście stanu sesji, więc UI jest właściwym właścicielem czyszczenia.

Po `reset()` UI woła `await start()` ponownie — to triggeruje AI jeśli AI zaczyna, lub emituje `turn` dla człowieka. Bez `start()` po resecie gra jest w stanie "gotowa ale nieuruchomiona" — `playMove()` odmówi z `game_not_running` dopóki `start()` nie zostanie wywołane.

Brak accessor `lastMove` na `GameSession`: gra zawsze zaczyna od zera (brak zapisu mid-game, brak reconnect). UI trzyma `lastMove` w swoim stanie, aktualizowany przez event `move`, czyszczony w handlerze `reset`. Po przeładowaniu karty/CLI gra startuje od nowa — brak potrzeby rekonstrukcji `lastMove` z historii.

#### `start()` — lifecycle AI-start-first

Problem: gdy AI zaczyna (`humanSymbol: 'X'`), konstruktor nie może bezpiecznie wykonać async ruchu AI — listenery nie są jeszcze zarejestrowane, eventy (`ai-thinking`, `move`) zostałyby utracone.

Rozwiązanie: `start(): Promise<StartResult>`. Konstruktor jest sync, tylko tworzy `Game` + sesję. UI woła `on()` po konstruktorze, potem `await start()`. Wynik rozróżnia `success`, `busy` i `aborted` (reset podczas rozpoczynającego ruchu AI).

- **PvP**: `start()` emituje `turn { player: 'O' }`. Nie ma AI.
- **Single Player, człowiek zaczyna** (`humanSymbol: 'O'`): `start()` emituje `turn { player: 'O' }`. Nie ma AI.
- **Single Player, AI zaczyna** (`humanSymbol: 'X'`): `start()` emituje `ai-thinking`, wykonuje ruch AI, emituje `move`, potem `turn` dla człowieka (lub `finished` jeśli AI wygrało w pierwszym ruchu — niemożliwe na 3x3, ale kontrakt musi to obsłużyć).
- **AI vs AI**: nie ma `start()` — `step()` lub `run()` same inicjują grę (pierwsze wywołanie = pierwszy ruch gracza 1).

`start()` można wywołać tylko raz na sesję (przed `reset()`). Drugie `start()` bez `reset()` rzuca `Error`. Po `reset()` `start()` jest ponownie wymagane.

#### Współbieżność — ochrona przed race conditions

Problem: `playMove()`, `start()`, `step()`, `run()` są async (AI liczy). Jeśli użytkownik wywoła którąkolwiek ponownie lub `reset()` podczas obliczeń AI, stary Promise może zapisać ruch do już zresetowanej gry.

Rozwiązanie: **generation counter** na sesji. Busy flag jest **per-generacja**, nie globalny — eliminuje race w `finally`.

```ts
// Wewnętrzny stan sesji:
private _generation = 0;       // inkrementowane przez reset()
private _busyGeneration: number | null = null;  // numer generacji która jest zajęta, lub null
```

**Kluczowa zasada**: `_busyGeneration` przechowuje **numer generacji** która zajęła sesję, nie boolean. `finally` czyści flagę **tylko jeśli jej generacja się zgadza** — stara operacja nie wyczyści flagi należącej do nowej.

**Wspólny wzorzec dla wszystkich async operacji** (`start`, `playMove`, `step`, `run`). Każda metoda mapuje wynik na swój jawny kontrakt: `StartResult`, `PlayMoveResult` albo `RunResult`:

```ts
// 1. Guard: jeśli sesja zajęta → return { status: 'busy' }
if (this._busyGeneration !== null) return { status: 'busy' };

// 2. Zajmij sesję z przechwyceniem generacji
const gen = this._generation;
this._busyGeneration = gen;

try {
  // ... async praca (AI liczy, game.savePlayerMove, eventy) ...

  // 3. Po KAŻDYM await: sprawdź generację
  //    (najpierw generacja, potem walidacja wyniku — patrz niżej)
  if (this._generation !== gen) return { status: 'aborted' };

  // ... kontynuuj ...
} finally {
  // 4. Zwolnij sesję TYLKO jeśli to nasza generacja
  if (this._busyGeneration === gen) {
    this._busyGeneration = null;
  }
}
```

`run()` kończące grę zwraca `{ status: 'completed', result: game.gameStatus }`. `busy` i `aborted` są zatem reprezentowalne bez mieszania ich z domenowym `GameStatus`. `start()` analogicznie zwraca `{ status: 'success' }`, `{ status: 'busy' }` albo `{ status: 'aborted' }`.

**Dlaczego `finally` sprawdza generację**: bez tego, stara operacja (przerwana przez reset) w swoim `finally` ustawiłaby `_busyGeneration = null`, czyszcząc flagę którą nowa operacja już zajęła. Z sprawdzeniem generacji: stara operacja widzi `gen !== _busyGeneration` (nowa operacja zmieniła) i nie czyści.

- `reset()`:
  - Inkrementuje `_generation` (unieważnia wszystkie w locie operacje).
  - Jeśli `_busyGeneration !== null` → ustawia `_busyGeneration = null` (sesja będzie wolna po resecie; stara operacja w `finally` nie wyczyści bo jej generacja się nie zgadza).
  - Wywołuje `game.reset()`.
  - Ustawia lifecycle na `'idle'` (wymaga `start()` przed `playMove()`).

**Kolejność walidacji po `await calculateMove`**:

```ts
const aiMove = await strategy.calculateMove(game.board, context);

// 1. NAJPIERW generacja — wykryj dezaktualizację operacji
if (this._generation !== gen) return { status: 'aborted' };

// 2. DOPERO POTEM walidacja wyniku strategii
if (!isLegalMove(aiMove, game.board)) {
  throw new MoveStrategyError('illegal_move', `Strategy returned illegal index: ${aiMove}`);
}

// 3. Zastosuj ruch
game.savePlayerMove(aiMove);
```

Ta sama kontrola obowiązuje dla odrzuconego Promise. `catch` najpierw sprawdza `this._generation !== gen`; jeśli operację unieważnił reset, zwraca `aborted` i nie zmienia lifecycle ani nie emituje `finished`. Dopiero dla aktualnej generacji interpretuje `MoveStrategyError` lub propaguje nieoczekiwany błąd.

Dlaczego generacja pierwsza: po resecie stary wynik AI może dotyczyć zajętego pola (nowa gra ma pustą planszę, ale stary snapshot miał inne pole zajęte). Bez sprawdzenia generacji, stary wynik mógłby zostać błędnie zgłoszony jako `illegal_move` zamiast `aborted`.

**Lifecycle stan sesji** (osobny od `GameStatus`):

```ts
type SessionLifecycle = 'idle' | 'started' | 'finished';
private _lifecycle: SessionLifecycle = 'idle';
```

- `'idle'` — po konstruktorze i po `reset()`. `playMove()` zwraca `{ status: 'game_not_running' }`.
- `'started'` — po `await start()` (pvp/singleplayer) lub pierwszym `step()`/`run()` (aivsai). `playMove()` działa.
- `'finished'` — po `finished` evencie. `playMove()` zwraca `{ status: 'game_not_running' }`.

To rozwiązuje problem "playMove przed start() zwraca `game_not_running` mimo że `GameStatus` to `running`": to **lifecycle sesji** decyduje, nie `GameStatus`. `Game.gameStatus` to `running` od konstruktoru, ale sesja jest `idle` dopóki `start()` nie zostanie wywołane.

`PlayMoveResult` rozszerzone o:

```ts
export type PlayMoveResult =
  | { status: 'success' }
  | { status: 'invalid_index' }
  | { status: 'already_selected' }
  | { status: 'game_not_running' }
  | { status: 'busy' }        // operacja wywołana podczas trwania innej operacji
  | { status: 'aborted' };    // operacja przerwana przez reset() podczas obliczeń AI
```

UI reaguje na `busy` ignorując (np. drugi klik podczas AI — nic nie rób). `aborted` jest transparentne — UI nie musi go obsługiwać bo `reset()` już wyczyścił stan.

---

## 6. Eventy — sesje emitują bezpośrednio, nie tłumaczą `STATE_CHANGE`

- `Game` nadal emituje tylko `STATE_CHANGE` (istniejący, stabilny) — dla bezpośrednich użytkowników `Game` i backward compat.
- **Sesje nie tłumaczą `STATE_CHANGE` na eventy sesji.** `STATE_CHANGE` nie zawiera pozycji ani przyczyny zmiany (`{ board, currentPlayer, gameStatus }`), więc nie wystarcza do odtworzenia `move { player, position }`.
- Sesje emitują eventy sesji **bezpośrednio** na podstawie własnej wiedzy o tym co zrobiły — sesja wie że wywołała `game.savePlayerMove(4)` dla gracza `'O'`, więc emituje `move { player: 'O', position: 4 }`. Nie musi inferować tego ze snapshotu.
- Sesje mają własny emitter (`eventemitter3` z typowaną `GameSessionEvent`). To nie jest "równoległy system" — to wyższa warstwa abstrakcji z bogatszymi eventami.
- `TicTacToe` facade deleguje `on`/`off` do emittera sesji.
- `STATE_CHANGE` z `Game` jest ignorowane przez sesje (nie nasłuchują go). Sesje kontrolują przepływ: wywołują `game.savePlayerMove` i emitują własne eventy w znanej kolejności.

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
- `getBestMove` (funkcja-helper) zostaje — przydatne dla zaawansowanych użytkowników z `IGame`. **Nie jest używane wewnętrznie przez `AlphaBetaStrategy`** (strategia używa `alphaBeta` bezpośrednio — patrz §4.1).
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
│   ├── types.ts                          (nowy — options, typy instancji, TicTacToeConstructor)
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
│   ├── getBestMove.ts                    (istnieje — refaktor: importuje DIFFICULTY_CONFIG z difficultyConfig.ts)
│   ├── difficultyConfig.ts               (nowy — współdzielona DIFFICULTY_CONFIG, używana przez getBestMove i AlphaBetaStrategy)
│   ├── AIPlayer.ts                       (USUNIĘTE)
│   ├── strategy.types.ts                 (nowy — MoveStrategy, MoveContext, MoveStrategyError)
│   ├── AlphaBetaStrategy.ts              (nowy — używa alphaBeta bezpośrednio, persistent RNG)
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

### Podstawowe

1. `TicTacToe({ mode: 'pvp' })` tworzy działającą sesję PvP z jednolitym API.
2. `TicTacToe({ mode: 'singleplayer', ai: { engine: 'alphabeta', difficulty: 'hard' } })` tworzy sesję z AI, gdzie po ruchu człowieka AI automatycznie odpowiada.
3. `TicTacToe({ mode: 'singleplayer', ai: { engine: 'random' } })` używa silnika losowego.
4. `TicTacToe({ mode: 'aivsai', aiPlayers: [...] })` tworzy sesję AI-vs-AI z `step()`/`run()`.
5. `humanSymbol` kontroluje kto zaczyna (O = człowiek, X = AI).
6. Eventy `move`/`ai-thinking`/`turn`/`finished` są emitowane w poprawnej kolejności.
7. Niepoprawny ruch człowieka nie uruchamia AI.
8. AI nie wykonuje ruchu po zakończeniu gry.
9. `AIPlayer` jest usunięte; `getBestMove` zostaje.
10. `RandomStrategy` zwraca tylko legalne ruchy (nigdy na zajęte pole).
11. Wewnętrzne klasy (`Game`, `MoveStrategy`, sesje) pozostają publicznie eksportowane dla zaawansowanych użytkowników.
12. `Game` nie wie nic o AI, trybach, sesjach, facade — bez zmian w `game/`.
13. `yarn test`, `yarn ts:check`, `yarn lint`, `yarn build` przechodzą.

### Edge case'y (wymagane testy)

 1. **AI zaczyna** (`humanSymbol: 'X'`): `await start()` wykonuje pierwszy ruch AI, emituje `ai-thinking` → `move` → `turn` (dla człowieka). Eventy nie są utracone (listenery zarejestrowane przed `start()`).
 2. **Reset podczas obliczeń AI**: `reset()` wywołane w trakcie `await playMove()` (AI liczy) → stary Promise zwraca `{ status: 'aborted' }`, ruch AI nie jest aplikowany, plansza jest pusta po resecie.
 3. **Podwójny input**: drugie `playMove()` podczas trwania pierwszego → zwraca `{ status: 'busy' }`, nie uruchamia drugiego AI.
 4. **Strategia zwraca nielegalny ruch**: custom `MoveStrategy` zwraca indeks zajętego pola → sesja rzuca `MoveStrategyError('illegal_move')`, ruch nie jest aplikowany.
 5. **Brak legalnych ruchów**: `RandomStrategy` i `AlphaBetaStrategy` wywołane bezpośrednio na pełnej planszy rzucają `MoveStrategyError('no_legal_moves')`; sesja nie uruchamia strategii, jeśli `Game` jest już zakończone.
 6. **Strategia rzuca nieoczekiwany błąd**: custom strategia rzuca `Error` → sesja propaguje błąd (nie łapie), `_busyGeneration` jest czyszczone w `finally` tylko przez właściciela tej generacji.
 7. **`start()` wywołane dwukrotnie bez `reset()`**: rzuca `Error`.
 8. **`playMove()` przed `start()`**: zwraca `{ status: 'game_not_running' }`.
 9. **Reset + ponowne `start()`**: gra restartuje się poprawnie, AI zaczyna jeśli `humanSymbol: 'X'`.
10. **Persistent RNG w `AlphaBetaStrategy`**: generator nie jest inicjalizowany ponownie przy każdym `calculateMove`; dwie świeże instancje z tym samym seedem odtwarzają tę samą sekwencję. Test nie zakłada, że każde dwa kolejne losowania muszą dać różne wartości.
11. **Typowanie eventów**: `on('move', handler)` — TypeScript wie że `handler` dostaje `{ player, position }`, nie `any`.
12. **Brak mutacji snapshotu**: `MoveStrategy.calculateMove` nie modyfikuje `board` (readonly).
13. **Reset po odrzuceniu Promise strategii**: jeśli stara strategia odrzuci Promise po `reset()`, operacja zwraca `aborted`, nie zmienia lifecycle nowej gry i nie emituje `finished`.
14. **Reentrantny handler eventu**: handler `move` próbujący synchronicznie wywołać kolejne `playMove()` dostaje `busy`.
15. **`AIGame.run()` i lock**: `run()` wykonuje wiele prywatnych `_performStep(gen)` bez wywoływania publicznego `step()` i bez samoblokady.
16. **Jawne wyniki operacji**: równoległe `start()` zwraca `{ status: 'busy' }`, reset podczas `start()` zwraca `{ status: 'aborted' }`, a `run()` kończy się `{ status: 'completed', result }` lub zwraca `busy`/`aborted` zgodnie z kontraktem.

---

## 12. Relacja do istniejących planów

- **`PLAN-v2.0.md`** — warstwa AI (alpha-beta, getBestMove, trudność). **Zaimplementowane**, z wyjątkiem `AIPlayer` (wycofywane w v2.1). Pozostaje jako historyczny opis warstwy AI.
- **`t3core-implementation-plan.md`** — wewnętrzna architektura sesji (`Game`, `MoveStrategy`, `SinglePlayerGame`, `PvPGame`, eventy, stany). **Nadrzędny dla warstwy orkiestracji**. Ten plan (v2.1) dodaje facade na wierzchu i `RandomStrategy` obok `AlphaBetaStrategy`.
- **Ten plan (v2.1)** — facade + `RandomStrategy` + wycofanie `AIPlayer` + `AIGame`. Zależy od v2.0 (AI) i `t3core-implementation-plan.md` (sesje).

Kolejność implementacji: najpierw warstwa sesji z `t3core-implementation-plan.md` (Etap 1-6), potem `RandomStrategy` + `AlphaBetaStrategy` (Etap 2 rozszerzony), potem facade (Etap 7 rozszerzony z `GameFactory` → `TicTacToe`), potem `AIGame`, potem testy.
