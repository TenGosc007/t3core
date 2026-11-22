import type { EngineError } from "../results";
import type { SessionIdentity, SessionSnapshot } from "./types";
import type { Game } from "@/game/Game";
import type { GameEventPayload } from "@/game/types/Game.types";

import { createSnapshot } from "./createSnapshot";

/** Owns cached state and subscriptions without attaching listeners to Game. */
export class SessionStore {
  private _snapshot: SessionSnapshot;
  private _source: GameEventPayload;
  private readonly _listeners = new Set<{ callback: () => void }>();

  constructor(
    private readonly _game: Game,
    private readonly _identity: SessionIdentity,
  ) {
    this._source = _game.snapshot;
    this._snapshot = createSnapshot(_game, _identity, "idle", null);
  }

  readonly getSnapshot = (): SessionSnapshot => this._snapshot;

  readonly subscribe = (callback: () => void): (() => void) => {
    const entry = { callback };
    this._listeners.add(entry);
    return () => {
      this._listeners.delete(entry);
    };
  };

  clear(): void {
    this._listeners.clear();
  }

  publish(phase: SessionSnapshot["phase"], error: EngineError | null = null): void {
    if (
      this._source === this._game.snapshot &&
      this._snapshot.phase === phase &&
      this._snapshot.error?.code === error?.code &&
      this._snapshot.error?.message === error?.message
    ) return;
    const next = createSnapshot(
      this._game, this._identity, phase, error, this._snapshot,
    );
    this._source = this._game.snapshot;
    this._snapshot = next;
    for (const entry of [...this._listeners]) {
      // A nested reset publishes its own snapshot; stop the obsolete delivery.
      if (this._snapshot !== next) break;
      if (this._listeners.has(entry)) entry.callback();
    }
  }
}
