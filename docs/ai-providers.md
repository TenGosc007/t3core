# AI providers

Register providers per game through `aiProviders`, then select one with
`ai.engine`. Built-in IDs are `alphabeta` and `random`; they cannot be replaced
by registering another provider with the same ID. Only `classic-3x3` is currently
available. A provider's compatibility list uses complete variant IDs rather
than board dimensions; future variants may have different win lengths.

## Discover available engines

```ts
import { TicTacToe } from 't3core';

const capabilities = TicTacToe.getCapabilities({ variant: 'classic-3x3' });
console.log(capabilities.variant); // Dimensions, winLength and lineRule.
console.log(capabilities.modes); // pvp, singleplayer, aivsai.
console.log(capabilities.defaultAIEngine); // alphabeta.
console.log(capabilities.aiEngines); // IDs, behavior versions and difficulties.
```

Pass `aiProviders` to include custom providers in this query. The result is
frozen metadata with no factories. Discovery checks metadata, but never calls
`validateOptions` or `create` and never initializes engine resources. Unknown
variants throw. A known variant without compatible engines reports only `pvp`,
an empty engine list and `defaultAIEngine: null`. This is tested through an
isolated internal rule catalog; no additional public variant is introduced.

## Implement a provider

This small example chooses the first or last legal move. It demonstrates typed
configuration without introducing a search algorithm or background execution.

```ts
import { TicTacToe } from 't3core';
import type { AIProvider } from 't3core';

const choice: AIProvider<'choice', { prefer: 'first' | 'last' }> = {
  id: 'choice',
  version: '1.0.0',
  supportedVariants: ['classic-3x3'],
  difficulties: [],
  defaultDifficulty: null,
  validateOptions(options) {
    if (typeof options !== 'object' || options === null ||
        !('prefer' in options) ||
        (options.prefer !== 'first' && options.prefer !== 'last')) {
      throw new TypeError('Expected prefer: first or last');
    }
    return { prefer: options.prefer };
  },
  create({ prefer }) {
    return {
      async calculateMove(input, { signal }) {
        if (signal.aborted) throw new Error('Request cancelled');
        const moves = input.rules.getLegalMoves(input.board, input.aiSymbol);
        const index = prefer === 'first' ? moves[0] : moves[moves.length - 1];
        if (index === undefined) throw new Error('No legal moves');
        return index;
      },
      dispose() {}, // Release resources here when this provider owns any.
    };
  },
};

const game = new TicTacToe({
  mode: 'aivsai',
  aiProviders: [choice],
  aiPlayers: [
    { engine: 'choice', prefer: 'last' }, // O
    { engine: 'alphabeta', difficulty: 'hard', seed: 1 }, // X
  ],
});
const result = await game.run();
console.log(result);
game.dispose();
```

Keep the literal engine ID in the provider's generic type so TypeScript can
infer the corresponding options. For separately annotated configurations use
`AIConfig<readonly [typeof choice]>` or `TicTacToeOptions<readonly [typeof choice]>`.
The declarations require TypeScript 5.4 or newer (`NoInfer` and const generics).
JavaScript callers still receive runtime validation.

`validateOptions(unknown)` returns normalized, typed options, without allocating
resources. Each provider validates its own fields and defaults; it should copy
mutable option data it retains. The catalog checks engine compatibility and
difficulty membership first, supplying `defaultDifficulty` when omitted.
An engine with no difficulty profiles uses `[]` and `null`.
Both AI-vs-AI configurations are validated before either factory runs.

`create(options)` is synchronous and must return a fresh, privately owned
`AIStrategy` for each AI player and session. Initialize expensive resources
lazily in `calculateMove`; the constructor performs no calculations.
If construction fails after creating another player, that player's resources
are disposed before the original exception is rethrown. A factory must clean up
its own partially allocated resources if it throws before returning them.

## Calculation, cancellation and ownership

`calculateMove(input, request)` returns `Promise<number>` with a zero-based legal
move index. The frozen input contains the board, O/X symbols, current status,
variant descriptor and stateless `GameRules`. Simulate on a private board copy,
using `getLegalMoves`, `isLegalMove` and `getStatus`; never mutate the input.
The session validates the returned move through the same Game rules as human
input. A rule-specific human refusal is `rejected/illegal_move`; an invalid AI
answer produces `error/illegal_ai_move`.

Each calculation receives a distinct `AbortSignal`. Stop, restart, valid undo
and disposal abort the active request and settle the old action as
`aborted`. A completed request's signal is not subsequently aborted. Remove
abort listeners when the request completes. Cancellation must stop or discard
the provider's own work; it does not destroy the strategy, which can be reused
immediately by a new request. Tag background requests so late responses cannot
resolve a newer calculation. The session also ignores late results and failures
when a provider ignores its signal.

The session owns strategies and calls `dispose()` once when closing permanently.
Stop/restart/undo retain them, including their RNG sequence and loaded resources.
Dispose must release Workers, listeners and other owned resources. All players
are cleaned up even if one cleanup throws. Cleanup exceptions propagate after
the session is closed; an application subscriber exception takes precedence.

Throw `AIProviderError('ai_initialization_failed', message)` from lazy
initialization, or `AIProviderError('ai_timeout', message)` when the provider's
search budget expires without a usable answer. Sessions return a serializable
error action and publish its code/message. Other calculation failures use
`ai_failed`. Provider time budgets are provider-owned; the core sets no timer.

Signals and promises cannot preempt synchronous JavaScript. Actual Worker/WASM
execution remains future work. `GameRules` contains functions and cannot be
structured-cloned into a Worker; a future provider bridge must transfer plain
position data and select its matching rules inside the worker. WASM may run
inside that worker. No worklet is needed for the current 3×3 engines.

Internal sessions use a board/context move interface behind an adapter. These
classes and adapters are implementation details, not package exports. Consumer
integrations use `AIProvider` and the required `AIStrategy` contract above.
