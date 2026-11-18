import type { ActionAborted, ActionSuccess } from "../results";

/** A lock owner with prompt logical cancellation, independent of the strategy. */
export class SessionOperation {
  readonly cancelled: Promise<ActionAborted>;
  private _cancel = () => {};

  constructor(readonly generation: number) {
    this.cancelled = new Promise((resolve) => {
      this._cancel = () => resolve({ status: "aborted" });
    });
  }

  cancel(): void {
    this._cancel();
  }

  waitFor<Value>(work: Promise<Value>): Promise<ActionSuccess<Value> | ActionAborted> {
    return Promise.race([
      work.then((value): ActionSuccess<Value> => ({ status: "success", value })),
      this.cancelled,
    ]);
  }
}
