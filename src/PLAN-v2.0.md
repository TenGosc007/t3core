---
agent: devin-local
session: plaid-asphalt
created: 2026-08-15T19:29:54Z
---
# Plan v2.0 — Single Player (AI) with Difficulty Levels

Add a single-player mode against an AI opponent to `t3core`, initially for the `classic-3x3` variant only. The AI uses **Alfa-Beta pruning** (full Minimax with alpha-beta cutoffs) and exposes selectable **difficulty levels**. A "Ranking" menu entry is reserved as a stub with a "coming soon" hint (deferred to v2.5.0). Implementation is in TypeScript now; a Rust + WebAssembly port is noted as a follow-up.

---

## 1. Scope & decisions

### 1.1 In scope (v2.0)

- **Two game modes** (selected by the CLI/UI, not by the core):
  - **PVP** — local 2-player (existing behavior, unchanged).
  - **Single Player** — human vs AI.
  The core library stays mode-agnostic: PVP simply never instantiates `AIPlayer`; Single Player attaches an `AIPlayer` to one side. No `Game` API changes are needed to support modes.
- AI opponent for `classic-3x3` only.
- Algorithm: **Alfa-Beta pruning** (full search to terminal on 3x3 — feasible since 3x3 game tree is small: ≤ 9! / symmetries, trivially solvable).
- Difficulty levels: **Normal / Hard** (2 levels). An `EASY` level is intentionally omitted for 3x3 — the board is small enough that Normal already feels casual; a dedicated Easy level will be introduced together with larger boards (5x5+) in a future version, where the full game tree is too deep for casual play and a gentler floor is needed.
- Difficulty implemented via a **combination of techniques** from the comparison table:
  - **Depth limit** (technique #2) — primary knob.
  - **Mistake rate / randomness** (technique #1) — secondary knob, makes Normal feel natural rather than "blind" and gives the player a fighting chance against Hard.
  - On 3x3, full Alfa-Beta plays optimally, so an unbeatable "Hard" would make the game pointless. Instead "Hard" = limited depth + low mistake rate (the player has a small but real chance to win), and "Normal" = depth 1 + high mistake rate (very beatable).
- Public API: a new `AIPlayer` class plus a `getBestMove(game, options)` helper, exported from the package root. `AIPlayer` supports **both** auto-play (subscribes to `STATE_CHANGE` and moves on its turn) and manual use (`nextMove(game)`), so the CLI can drive Single Player either way. ✅ **Implemented** — `src/ai/AIPlayer.ts`, `src/ai/getBestMove.ts`, exported from `src/index.ts`.
- "Ranking" placeholder API surface (no-op + `coming soon` flag) so the CLI/UI can render the menu entry. ⏸ **Deferred** — not implemented in this iteration per user request; will be added together with actual ranking persistence in v2.5.0.
- Unit tests for the AI module (correctness of optimal play, deterministic behavior at Hard, non-optimality bounds at Normal). ✅ **Implemented** — `src/tests/ai/alphaBeta.test.ts` (6 tests), `src/tests/ai/getBestMove.test.ts` (11 tests), `src/tests/ai/AIPlayer.test.ts` (12 tests).
- **Deprecated APIs removed** (`boardSize`, `savePlayerSelection`, `getBoard`, `isFieldSelected`, `getFieldByNumber`/`setFieldByNumber`, `PLAYER_MOVE`/`RESET` events). ✅ **Done** — first task of the v2.0 cycle.

### 1.2 Out of scope (deferred)

- Larger boards (5x5+), MCTS, heuristics for big boards — future versions.
- Actual ranking/persistence — v2.5.0.
- CLI integration (mode selection menu, difficulty picker, ranking entry display) — handled in `t3core-cli`, not here (this is the core library). The core only exposes the building blocks.
- Rust/WASM port — see §7.

### 1.3 Algorithm choice rationale

Per the comparison table, **Pełny Alfa-Beta** is optimal for 3x3 (the table explicitly notes it is "bezbłędna gra na 3x3" and the only downside — combinatorial explosion — does not apply at 3x3). MCTS/heuristics are overkill for 3x3 and add complexity with no benefit at this board size. Difficulty is therefore achieved via **depth limit + mistake rate** layered on top of Alfa-Beta, exactly as the second table recommends for Minimax/Alfa-Beta family algorithms.

---

## 2. Difficulty level design

| Level | Depth | Mistake rate | Behavior |
|-------|-------|--------------|----------|
| `NORMAL` | 1     | 30%          | Sees only immediate moves; often plays randomly. Very beatable. |
| `HARD`   | 4     | 10%          | Looks 4 plies ahead; occasional blunders. Strong, but the player has a small real chance to win by capitalizing on a blunder. |

- No `EASY` level for 3x3 in v2.0 — Normal already fills the "casual" slot. Easy is deferred to the version that introduces larger boards (5x5+), where a gentler floor becomes meaningful.
- No unbeatable level: on 3x3 a full-depth Alfa-Beta is perfect and the best a perfect player can do is draw — that makes for a pointless Single Player mode. Hard is intentionally capped at depth 4 with a 10% mistake rate so the player always has a minimal chance to win.
- Mistake rate: with probability `p`, ignore the Alfa-Beta result and pick a uniformly random legal move. Seeded RNG optional (configurable via options) for reproducible tests.
- Depth limit: when depth is reached before a terminal node, return a score of `0` (neutral) — on 3x3 this is acceptable because Hard's depth 4 already covers most tactical situations; we do **not** introduce a positional heuristic in v2.0 (kept simple per user's "prosta wersja" request).

---

## 3. Public API design

### 3.1 New exports (added to `src/index.ts`)

```ts
export { AIPlayer } from "./ai/AIPlayer";
export { getBestMove } from "./ai/getBestMove";
export { AIDifficulty } from "./ai/types";
export type { AIOptions, AIMoveResult } from "./ai/types";
export { RankingPlaceholder } from "./ranking/RankingPlaceholder"; // stub
export type { RankingEntry, RankingStore } from "./ranking/types"; // stub types
```

### 3.2 Core types — `src/ai/types.ts`

```ts
export const AIDifficulty = {
  NORMAL: "normal",
  HARD: "hard",
} as const;
export type AIDifficulty = (typeof AIDifficulty)[keyof typeof AIDifficulty];

export type AIOptions = {
  difficulty?: AIDifficulty;        // default: HARD
  symbol?: PlayerSymbol;            // symbol the AI plays; default: second symbol (X)
  seed?: number;                    // optional RNG seed for reproducibility
};

export type AIMoveResult =
  | { status: "success"; index: number }
  | { status: "no_moves" }          // board full / game not running
  | { status: "invalid_state" };
```

### 3.3 `getBestMove(game, options?)` — pure helper

Stateless function: reads `game.board`, `game.gameStatus`, computes the best move for `game.currentPlayer` using Alfa-Beta + difficulty knobs, returns an `AIMoveResult`. Does **not** mutate the game. The caller (CLI/UI/`AIPlayer`) is responsible for calling `game.savePlayerMove(index)`.

### 3.4 `AIPlayer` — stateful convenience wrapper (supports both auto-play and manual use)

```ts
// Auto-play mode (Single Player): AI subscribes to STATE_CHANGE and moves on its turn
const ai = new AIPlayer({ difficulty: AIDifficulty.HARD, symbol: "X" });
ai.attach(game);            // subscribes to STATE_CHANGE; auto-plays when it's AI's turn
ai.detach();
ai.setDifficulty(AIDifficulty.NORMAL);

// Manual mode: caller decides when AI moves (e.g. CLI prompts step by step)
const result = ai.nextMove(game);   // returns AIMoveResult, applies the move via game.savePlayerMove
```

- **Auto-play** via `attach(game)`: subscribes to `GameEvent.STATE_CHANGE`, and when `game.currentPlayer === ai.symbol` and `game.gameStatus.status === "running"`, computes and applies the move. `detach()` unsubscribes.
- **Manual** via `nextMove(game)`: computes the best move for `game.currentPlayer` and applies it through `game.savePlayerMove(index)`. Returns `AIMoveResult`. The caller controls timing — useful for CLI flows that want to pause between moves or display the AI's "thinking" step.
- Respects `game.gameStatus` — never moves when game is not running.
- In **PVP mode** the CLI simply never creates an `AIPlayer`; `Game` behaves exactly as today.

### 3.5 `RankingPlaceholder` — stub for v2.5.0

```ts
export const RankingPlaceholder = {
  available: false,
  version: "2.5.0",
  message: "Ranking coming in v2.5.0",
} as const;
```

Plus a `RankingStore` interface that throws `NotImplementedError` on any method, so the CLI can wire the menu entry now and the contract is stable for v2.5.0.

---

## 4. Implementation structure

```
src/
  ai/
    types.ts                 # AIDifficulty, AIOptions, AIMoveResult
    alphaBeta.ts             # core minimax + alpha-beta (board-agnostic over a 9-cell array)
    getBestMove.ts           # difficulty knobs + RNG + move selection wrapper
    AIPlayer.ts              # stateful wrapper with event subscription
    index.ts                 # internal barrel
  ranking/
    types.ts                 # RankingEntry, RankingStore interface (stub)
    RankingPlaceholder.ts    # static stub object
    index.ts
  tests/
    ai/
      alphaBeta.test.ts      # optimal-play correctness on 3x3
      getBestMove.test.ts    # difficulty behavior bounds
      AIPlayer.test.ts       # attach/detach/auto-play
    ranking/
      RankingPlaceholder.test.ts
```

### 4.1 `alphaBeta.ts` — core algorithm

Pure function operating on a plain `BoardField[]` (no `Game`/`Board` dependency) so it is trivially testable and reusable for the future Rust port (same signature shape).

```ts
type Score = number;
const WIN_SCORE = 10;
const LOSS_SCORE = -10;
const DRAW_SCORE = 0;

function alphaBeta(
  fields: BoardField[],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiSymbol: PlayerSymbol,
  opponentSymbol: PlayerSymbol,
  maxDepth: number,
): Score
```

- Reuses `getWinnerFromFields` + the existing `WINNING_COMBINATIONS` from `classic3x3Strategy` (export the combinations from the strategy so the AI doesn't duplicate them).
- Terminal: win/loss/draw returns the corresponding score adjusted by `depth` (prefer faster wins / slower losses) — standard.
- `maxDepth = 4` for HARD (capped — a full-depth search would be unbeatable and make Single Player pointless on 3x3).
- Move ordering: center → corners → edges, to maximize alpha-beta cutoffs (cheap, no heuristic needed).

### 4.2 `getBestMove.ts` — difficulty layer

1. If `game.gameStatus.status !== "running"` → `no_moves`.
2. Collect legal indices.
3. Roll RNG: if `Math.random() < mistakeRate` → return random legal move.
4. Otherwise run `alphaBeta` for each legal move, pick the best score (ties broken by move ordering then RNG for variety on non-Hard levels).
5. Return `{ status: "success", index }`.

### 4.3 Difficulty config

```ts
const DIFFICULTY_CONFIG = {
  [AIDifficulty.NORMAL]: { maxDepth: 1, mistakeRate: 0.30 },
  [AIDifficulty.HARD]:   { maxDepth: 4, mistakeRate: 0.10 },
} as const;
```

### 4.4 RNG

- Default: `Math.random`.
- Optional seeded RNG (mulberry32) when `options.seed` is provided — used by tests for deterministic assertions.

---

## 5. Integration with existing `Game`

- **No changes to `Game` API.** The AI reads `game.board`, `game.currentPlayer`, `game.gameStatus` and writes via the existing `game.savePlayerMove(index)`. This keeps the core decoupled and the AI pluggable.
- Export `WINNING_COMBINATIONS` from `classic3x3Strategy` (or a new `classic3x3Constants.ts`) so the AI reuses the single source of truth for win detection. Avoid duplicating the combinations array.
- `AIPlayer.attach(game)` uses the existing `GameEvent.STATE_CHANGE` event — already supported and stable (not deprecated).

---

## 6. Verification plan

- `yarn test` — add new test files under `src/tests/ai/` and `src/tests/ranking/`.
- `yarn ts:check` — ensure new modules type-check.
- `yarn lint` — match existing ESLint config (perfectionist ordering, import-x).
- `yarn build` — ensure tsup emits the new exports.
- Test cases:
  - **Hard wins when a winning line is available**: place two AI symbols in a line, assert AI completes the three.
  - **Hard blocks opponent threats**: place two opponent symbols in a line, assert AI blocks.
  - **Hard is beatable**: with a fixed seed, assert that over N games a perfect/optimal player can win at least once against Hard (i.e. the 10% mistake rate creates a real winning opportunity). This replaces the old "Hard is unbeatable" assertion — Hard is intentionally not perfect on 3x3.
  - **Normal is suboptimal within bounds**: with a fixed seed, assert Normal sometimes fails to block (statistical test over N seeds).
  - **AIPlayer auto-play**: simulate a full game where AI plays both sides on Hard → result is `draw` or `win` for one side (never guaranteed draw, since both sides blunder ~10% of the time). Assert the game terminates and the board is consistent.
  - **No mutation**: `getBestMove` does not change `game.board` reference or contents.
  - **Ranking stub**: `RankingPlaceholder.available === false` and any `RankingStore` method throws.

---

## 7. Future: Rust + WebAssembly port (note only — not implemented in v2.0)

A follow-up version will replace the TypeScript `alphaBeta` core with a Rust implementation compiled to WASM via `wasm-bindgen` / `wasm-pack`, exposed through the same `getBestMove` signature. The pure-function design in §4.1 (operating on a plain `BoardField[]` with no `Game` dependency) is chosen specifically to make this port a drop-in replacement. The WASM build will be published as a separate entry point (e.g. `t3core/wasm`) so the pure-TS path remains the default and consumers can opt in. This matters once larger boards (5x5+) are introduced, where the TS Alfa-Beta becomes too slow and MCTS/heuristics in Rust become necessary.

---

## 8. Out-of-scope but noted

- CLI menu wiring for mode selection (PVP / Single Player), difficulty picker, and the "Ranking (coming soon)" entry belongs to `t3core-cli`, not this repo. This plan only ships the library primitives.
- **Deprecated APIs were removed** as the first task of the v2.0 cycle (`boardSize`, `savePlayerSelection`, `getBoard`, `isFieldSelected`, `getFieldByNumber`/`setFieldByNumber`, `PLAYER_MOVE`/`RESET` events). The AI + ranking stub ships on top of the cleaned-up API.
