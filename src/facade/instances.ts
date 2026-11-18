import type { BaseSession } from "@/sessions/BaseSession";
import type { PvPGame } from "@/sessions/PvPGame";
import type { SinglePlayerGame } from "@/sessions/SinglePlayerGame";
import type { GameSessionEventPayload, GameSessionEventType } from "@/sessions/types";

import { AIGame } from "@/sessions/AIGame";

/** Shared delegation; each concrete facade adds only its mode's actions. */
class SessionFacade<Session extends BaseSession> {
  constructor(protected readonly _session: Session) {}

  get board() { return this._session.board; }
  get currentPlayer() { return this._session.currentPlayer; }
  get gameStatus() { return this._session.gameStatus; }
  get snapshot() { return this._session.snapshot; }
  get movesCount() { return this._session.movesCount; }
  get mode() { return this._session.snapshot.mode; }

  readonly getSnapshot = () => this._session.getSnapshot();
  readonly subscribe = (callback: () => void): (() => void) => this._session.subscribe(callback);

  on<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this {
    this._session.on(event, handler);
    return this;
  }
  off<K extends GameSessionEventType>(event: K, handler: (payload: GameSessionEventPayload<K>) => void): this {
    this._session.off(event, handler);
    return this;
  }
  restart() { return this._session.restart(); }
  stop() { return this._session.stop(); }
  undo() { return this._session.undo(); }
  dispose(): void { this._session.dispose(); }
}

class HumanFacade extends SessionFacade<PvPGame | SinglePlayerGame> {
  start() { return this._session.start(); }
  playMove(index: number) { return this._session.playMove(index); }
}

class AIFacade extends SessionFacade<AIGame> {
  step() { return this._session.step(); }
  run() { return this._session.run(); }
}

export function createInstance(session: PvPGame | SinglePlayerGame | AIGame) {
  return session instanceof AIGame ? new AIFacade(session) : new HumanFacade(session);
}
