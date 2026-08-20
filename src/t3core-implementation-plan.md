# Plan implementacji trybów gry i AI w `t3core`

## Cel

Rozszerzyć `t3core` tak, aby był kompletnym silnikiem i warstwą orkiestracji rozgrywki dla:

- Player vs Player (PvP)
- Player vs Computer (single-player)

` t3core-cli` ma pozostać klientem/test harness'em. Nie powinien zawierać logiki gry ani AI.

Alpha-beta jest już zaimplementowane i **nie jest przedmiotem tego zadania**. Należy jedynie zdefiniować interfejs, przez który `t3core` może korzystać z gotowej implementacji AI.

---

## Główne założenia architektoniczne

### 1. `Game` pozostaje czystym silnikiem reguł

`Game` odpowiada wyłącznie za:

- stan planszy,
- aktualnego gracza,
- walidację ruchów,
- wykonywanie ruchów,
- wykrywanie zwycięstwa,
- wykrywanie remisu,
- reset,
- cofanie ruchów,
- udostępnianie snapshotu/stanu.

`Game` NIE powinien wiedzieć o:

- AI,
- trybie PvP,
- trybie single-player,
- CLI,
- spinnerze/loadingu,
- sposobie pobierania inputu.

Nie należy dodawać do `Game` logiki w rodzaju:

```ts
if (mode === 'singleplayer') {
    // uruchom AI
}
```

ani statusu:

```ts
'waiting_for_ai'
```

Oczekiwanie na AI jest stanem sesji, a nie stanem samej gry.

---

## 2. Strategia AI jako osobna abstrakcja

Wprowadzić interfejs w rodzaju:

```ts
interface MoveStrategy {
    calculateMove(board: BoardSnapshot): Promise<number>;
}
```

Strategia:

- otrzymuje snapshot planszy,
- wybiera ruch,
- zwraca pozycję,
- NIE modyfikuje `Game`.

Przykład:

```ts
class AlphaBetaStrategy implements MoveStrategy {
    async calculateMove(board: BoardSnapshot): Promise<number> {
        // istniejąca implementacja alpha-beta
    }
}
```

Ważne: API powinno być asynchroniczne (`Promise`), nawet jeżeli obecna implementacja alpha-beta jest synchroniczna.

Powody:

- możliwość użycia Worker Threads,
- możliwość użycia Web Workerów,
- możliwość użycia zewnętrznego AI,
- brak konieczności zmiany API `SinglePlayerGame` w przyszłości.

---

## 3. `SinglePlayerGame` jako orkiestrator

Dodać warstwę `SinglePlayerGame`.

Odpowiada za:

1. przyjęcie ruchu człowieka,
2. przekazanie go do `Game`,
3. sprawdzenie, czy gra się nie zakończyła,
4. poinformowanie klienta, że AI zaczyna myśleć,
5. przekazanie snapshotu do `MoveStrategy`,
6. oczekiwanie na wynik AI,
7. przekazanie ruchu AI do `Game`,
8. poinformowanie klienta o ruchu AI,
9. przejście do kolejki człowieka albo zakończenie gry.

Przykładowe API:

```ts
const session = new SinglePlayerGame(
    new Game(),
    new AlphaBetaStrategy()
);

await session.playMove(4);
```

Najważniejsze: `SinglePlayerGame` wykonuje ruch AI przez:

```ts
game.savePlayerMove(aiMove);
```

Nie wolno pozwolić, aby strategia AI samodzielnie modyfikowała `Game`.

Przepływ:

```text
Human move
    ↓
SinglePlayerGame
    ↓
Game.savePlayerMove()
    ↓
game still running?
    ↓
AI_THINKING
    ↓
MoveStrategy.calculateMove(snapshot)
    ↓
AI move
    ↓
Game.savePlayerMove()
    ↓
PLAYER_TURN / FINISHED
```

---

## 4. `PvPGame`

Dodać analogiczną warstwę `PvPGame`.

Odpowiada jedynie za orkiestrację dwóch zewnętrznych graczy.

Przykład:

```ts
const session = new PvPGame(new Game());

await session.playMove(4);
```

`PvPGame` nie potrzebuje AI.

---

## 5. Wspólny interfejs sesji

Jeżeli API obu trybów jest wystarczająco podobne, zdefiniować wspólny interfejs, np.:

```ts
interface GameSession {
    playMove(move: number): Promise<...>;

    on(...): void;

    get state(): ...;
}
```

Dzięki temu klient nie musi znać szczegółów implementacji:

```text
Client
  ↓
GameSession
  ├── PvPGame
  └── SinglePlayerGame
```

Jeżeli w trakcie implementacji okaże się, że wspólny interfejs powoduje sztuczne abstrahowanie, nie wymuszać go. Najważniejsze jest zachowanie czytelnego API.

---

# Stany

## `GameState`

Stan samej gry powinien reprezentować wyłącznie:

```ts
interface GameState {
    board: BoardSnapshot;
    currentPlayer: Player;
    gameStatus: GameStatus;
}
```

Przykładowo:

```ts
type GameStatus =
    | { type: 'running' }
    | { type: 'won'; winner: Player }
    | { type: 'draw' };
```

Dostosować nazwy do istniejącego API `t3core`, zamiast tworzyć drugi równoległy system statusów.

## Stan sesji single-player

`SinglePlayerGame` może mieć osobny stan:

```ts
type SinglePlayerSessionState =
    | {
        type: 'player-turn';
        player: Player;
      }
    | {
        type: 'ai-thinking';
        player: Player;
      }
    | {
        type: 'finished';
        result: GameStatus;
      };
```

Nie mieszać tych stanów z `GameStatus`.

---

# Eventy

Celem jest umożliwienie klientom reagowania na przebieg sesji bez ciągłego odpytywania obiektu.

Przewidywane zdarzenia:

```ts
type GameSessionEvent =
    | {
        type: 'move';
        player: Player;
        position: number;
      }
    | {
        type: 'ai-thinking';
        player: Player;
      }
    | {
        type: 'turn';
        player: Player;
      }
    | {
        type: 'finished';
        result: GameStatus;
      };
```

Należy dopasować to do istniejącego mechanizmu eventów w `t3core`, zamiast tworzyć drugi niezależny system.

Istniejący `STATE_CHANGE` powinien nadal służyć do komunikowania zmian stanu `Game`.

Jeżeli sensowniejsze okaże się rozszerzenie istniejącego systemu eventów, preferować rozszerzenie nad tworzeniem równoległego event emittera.

---

# Zachowanie po ruchu człowieka

Dla:

```ts
await session.playMove(4);
```

w single-player:

1. `SinglePlayerGame` otrzymuje ruch.
2. Wywołuje `Game.savePlayerMove(4)`.
3. Jeżeli ruch jest niepoprawny, zwraca odpowiedni wynik i NIE uruchamia AI.
4. Jeżeli ruch kończy grę:
   - nie uruchamia AI,
   - emituje `finished`.
5. Jeżeli gra trwa:
   - emituje `ai-thinking`,
   - pobiera snapshot,
   - wywołuje `await strategy.calculateMove(snapshot)`.
6. Po otrzymaniu ruchu AI:
   - wykonuje go przez `Game.savePlayerMove(aiMove)`.
7. Jeżeli AI zakończyło grę:
   - emituje `finished`.
8. Jeżeli gra trwa:
   - emituje `turn` dla człowieka.

---

# Zachowanie klienta/CLI

CLI ma być tylko konsumentem API.

Po ruchu człowieka:

```ts
await session.playMove(move);
```

CLI nie uruchamia samodzielnie AI.

Reaguje na event:

```ts
session.on('ai-thinking', () => {
    spinner.start();
});
```

i:

```ts
session.on('move', ({ player, position }) => {
    renderMove(player, position);
});
```

oraz:

```ts
session.on('turn', ({ player }) => {
    spinner.stop();
    enableInput(player);
});
```

Podczas `ai-thinking`:

- input użytkownika powinien być zablokowany,
- spinner powinien być aktywny,
- event loop nie powinien być blokowany.

---

# Ważne: CPU-bound alpha-beta

Jeżeli alpha-beta wykonuje się długo synchronicznie:

```ts
const move = calculateMove(board);
```

to samo `Promise` nie wystarczy do zapewnienia płynnego spinnera.

Długie obliczenia CPU mogą zablokować Node.js event loop.

Docelowo rozważyć wykonanie AI w:

- Worker Thread w Node.js,
- albo innym mechanizmie równoległego wykonywania.

Nie jest to jednak wymagane do pierwszej implementacji, jeśli alpha-beta dla obecnego rozmiaru planszy jest wystarczająco szybkie.

Nie komplikować pierwszej wersji bez pomiarów.

---

# Wybór trybu gry

Tryb gry powinien być wybierany przez warstwę tworzącą sesję, a nie przez `Game`.

Można zdefiniować:

```ts
type GameMode =
    | 'pvp'
    | 'singleplayer';
```

Następnie np. fabrykę:

```ts
class GameFactory {
    static createPvP(): GameSession {
        return new PvPGame(new Game());
    }

    static createSinglePlayer(
        strategy: MoveStrategy
    ): GameSession {
        return new SinglePlayerGame(
            new Game(),
            strategy
        );
    }
}
```

Przykład:

```ts
const session =
    mode === 'pvp'
        ? GameFactory.createPvP()
        : GameFactory.createSinglePlayer(
            new AlphaBetaStrategy()
        );
```

Nie robić:

```ts
new Game({
    mode: 'singleplayer'
});
```

`Game` nie powinien znać pojęcia trybu gry.

---

# Docelowy przepływ zależności

```text
                         t3core
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
        Game         GameSession      MoveStrategy
          │                │                │
          │          ┌─────┴─────┐          │
          │          │           │          │
          │          ▼           ▼          ▼
          │       PvPGame   SinglePlayer  AlphaBeta
          │                         │
          │                         │
          └─────────────────────────┘
```

Klient:

```text
                    t3core
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
            CLI                 GUI/Web
```

Żaden klient nie powinien implementować reguł gry ani sterowania AI.

---

# Przykład użycia

## PvP

```ts
const session = GameFactory.createPvP();

session.on('move', renderMove);
session.on('turn', renderTurn);
session.on('finished', renderResult);

await session.playMove(4);
```

## Single-player

```ts
const strategy = new AlphaBetaStrategy();

const session = GameFactory.createSinglePlayer(
    strategy
);

session.on('ai-thinking', () => {
    spinner.start();
});

session.on('move', ({ player, position }) => {
    renderMove(player, position);
});

session.on('turn', ({ player }) => {
    spinner.stop();
    renderTurn(player);
});

session.on('finished', result => {
    spinner.stop();
    renderResult(result);
});

await session.playMove(4);
```

---

# Kolejność implementacji

## Etap 1 — analiza istniejącego API

- [ ] Przejrzeć aktualne `Game`, `Board`, `GameStatus`, `PlayerMoveStatus`, `STATE_CHANGE`, `snapshot`.
- [ ] Nie zmieniać istniejących publicznych API bez potrzeby.
- [ ] Zidentyfikować istniejący system eventów.
- [ ] Zidentyfikować sposób reprezentowania pozycji/ruchu.
- [ ] Zidentyfikować istniejący interfejs lub implementację alpha-beta.

## Etap 2 — abstrakcja strategii

- [ ] Dodać `MoveStrategy`.
- [ ] Zdefiniować `calculateMove(BoardSnapshot): Promise<Move>`.
- [ ] Podpiąć istniejącą implementację alpha-beta pod `MoveStrategy`.
- [ ] Nie przenosić logiki alpha-beta do `Game`.
- [ ] Dodać test jednostkowy potwierdzający, że strategia tylko wybiera ruch.

## Etap 3 — `SinglePlayerGame`

- [ ] Utworzyć `SinglePlayerGame`.
- [ ] Wstrzyknąć `Game`.
- [ ] Wstrzyknąć `MoveStrategy`.
- [ ] Zaimplementować `playMove`.
- [ ] Walidować ruch człowieka przez `Game`.
- [ ] Nie uruchamiać AI dla niepoprawnego ruchu.
- [ ] Nie uruchamiać AI po zakończeniu gry.
- [ ] Przekazywać AI aktualny snapshot.
- [ ] Wykonywać ruch AI przez `Game`.
- [ ] Obsłużyć zakończenie gry po ruchu AI.
- [ ] Obsłużyć przejście z powrotem do tury człowieka.

## Etap 4 — eventy

- [ ] Wykorzystać istniejący system eventów `t3core`.
- [ ] Dodać event informujący o rozpoczęciu obliczania AI.
- [ ] Dodać/rozszerzyć event ruchu tak, aby klient znał gracza i pozycję.
- [ ] Dodać event zmiany tury, jeśli jest potrzebny.
- [ ] Dodać event zakończenia sesji.
- [ ] Zadbać o spójność payloadów.

## Etap 5 — `PvPGame`

- [ ] Utworzyć `PvPGame`.
- [ ] Wykorzystać ten sam `Game`.
- [ ] Zapewnić analogiczne API `playMove`.
- [ ] Nie dodawać zależności od AI.

## Etap 6 — wspólne API sesji

- [ ] Sprawdzić, czy `PvPGame` i `SinglePlayerGame` mogą implementować wspólny `GameSession`.
- [ ] Nie wymuszać abstrakcji, jeśli prowadzi do sztucznych wyjątków.
- [ ] Udostępnić klientowi jednolity sposób reagowania na ruchy i zakończenie gry.

## Etap 7 — factory

- [ ] Dodać `GameMode`.
- [ ] Dodać factory/builder do tworzenia odpowiedniej sesji.
- [ ] Factory ma tworzyć `Game` + odpowiednią warstwę sesji.
- [ ] `Game` nie otrzymuje `GameMode`.

## Etap 8 — testy

### `Game`

- [ ] Zachować istniejące testy.
- [ ] Potwierdzić brak regresji.

### `MoveStrategy`

- [ ] Zwraca poprawny ruch.
- [ ] Nie mutuje wejściowego snapshotu.

### `SinglePlayerGame`

- [ ] Poprawny ruch człowieka uruchamia AI.
- [ ] Niepoprawny ruch człowieka nie uruchamia AI.
- [ ] AI otrzymuje stan po ruchu człowieka.
- [ ] Ruch AI trafia przez `Game`.
- [ ] AI nie wykonuje ruchu po zakończeniu gry człowieka.
- [ ] Gra kończy się poprawnie po ruchu AI.
- [ ] Po ruchu AI poprawnie wraca tura człowieka.
- [ ] Eventy są emitowane w poprawnej kolejności.

Przykładowa kolejność:

```text
MOVE
AI_THINKING
MOVE
TURN
```

lub w przypadku końca:

```text
MOVE
AI_THINKING
MOVE
FINISHED
```

## Etap 9 — aktualizacja CLI

CLI ma służyć głównie do weryfikacji API.

- [ ] Dodać wybór PvP / single-player.
- [ ] Wstrzyknąć `AlphaBetaStrategy`.
- [ ] Obsłużyć `ai-thinking`.
- [ ] Pokazać spinner.
- [ ] Zablokować input podczas AI.
- [ ] Obsłużyć event ruchu AI.
- [ ] Ponownie aktywować input po `turn`.
- [ ] Zatrzymać spinner po `finished`.
- [ ] Nie umieszczać logiki AI w CLI.

---

# Kryteria ukończenia

Implementację można uznać za zakończoną, gdy:

1. `Game` nadal działa niezależnie od AI i trybu gry.
2. Można utworzyć sesję PvP.
3. Można utworzyć sesję single-player z dowolnym `MoveStrategy`.
4. Ruch człowieka w single-player automatycznie powoduje ruch AI.
5. AI korzysta wyłącznie z `BoardSnapshot` i zwraca ruch.
6. Ruch AI jest wykonywany przez `Game`.
7. Klient otrzymuje informację, że AI rozpoczęło obliczenia.
8. Klient otrzymuje informację o ruchu AI i jego pozycji.
9. Klient otrzymuje informację o kolejnej turze albo zakończeniu gry.
10. Niepoprawny ruch nie uruchamia AI.
11. AI nie wykonuje ruchu po zakończeniu gry.
12. Całość jest dostępna przez publiczne API `t3core`.
13. CLI nie zawiera logiki domenowej gry ani algorytmu AI.
14. Istnieją testy pokrywające pełny lifecycle single-player.

---

# Najważniejsza zasada

`Game` odpowiada na pytanie:

> "Czy ten ruch jest poprawny i jak zmienia on stan gry?"

`MoveStrategy` odpowiada na pytanie:

> "Jaki ruch powinien zostać wykonany?"

`SinglePlayerGame` odpowiada na pytanie:

> "Co powinno wydarzyć się po ruchu człowieka i kiedy AI ma wykonać swój ruch?"

Klient odpowiada na pytanie:

> "Jak pokazać użytkownikowi aktualny stan i umożliwić mu wykonanie ruchu?"

To rozdzielenie powinno pozostać podstawową zasadą implementacji.
