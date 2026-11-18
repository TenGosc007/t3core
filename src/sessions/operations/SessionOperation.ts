import type { ActionAborted, ActionSuccess } from "../results";

/** A lock owner; each calculation has its own cooperatively cancellable request. */
export class SessionOperation {
  readonly cancelled: Promise<ActionAborted>;
  private _request: AbortController | null = null;
  private _cancel = () => {};
  private _cancelled = false;

  constructor(readonly generation: number) {
    this.cancelled = new Promise((resolve) => {
      this._cancel = () => resolve({ status: "aborted" });
    });
  }

  beginRequest(): AbortSignal {
    const controller = new AbortController();
    this._request = controller;
    if (this._cancelled) controller.abort();
    return controller.signal;
  }

  finishRequest(signal: AbortSignal): void {
    if (this._request?.signal === signal) this._request = null;
  }

  cancel(): void {
    this._cancelled = true;
    this._cancel();
    const request = this._request;
    this._request = null;
    request?.abort();
  }

  waitFor<Value>(work: Promise<Value>): Promise<ActionSuccess<Value> | ActionAborted> {
    return Promise.race([
      work.then((value): ActionSuccess<Value> => ({ status: "success", value })),
      this.cancelled,
    ]);
  }
}
