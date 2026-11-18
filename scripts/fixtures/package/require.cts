import core = require("t3core");

const capabilities: core.GameCapabilities = core.TicTacToe.getCapabilities();
if (capabilities.defaultAIEngine !== "alphabeta" || !Object.isFrozen(capabilities)) {
  throw new Error("CommonJS capability discovery does not work");
}
const timeout = new core.AIProviderError("ai_timeout", "Search budget exhausted");
if (timeout.code !== "ai_timeout") throw new Error("CommonJS provider errors are unavailable");

const game: core.IGame = new core.Game();
if (game.savePlayerMove(0) !== core.PlayerMoveStatus.SUCCESS || game.board[0] !== "O") {
  throw new Error("CommonJS require does not expose a working Game");
}

const pvp: core.PvPInstance = new core.TicTacToe({ mode: "pvp" });
if (pvp.mode !== "pvp") {
  throw new Error("CommonJS require does not expose the typed facade");
}

const { getSnapshot, subscribe } = pvp;
const state: core.SnapshotFor<"pvp"> = getSnapshot();
let notifications = 0;
const unsubscribe = subscribe(() => { notifications++; });
pvp.reset();
unsubscribe();
pvp.reset();
if (state.phase !== "idle" || notifications !== 1 || !Object.isFrozen(getSnapshot())) {
  throw new Error("CommonJS session observation does not work");
}

const stopped: core.StopResult = pvp.stop();
const undone: core.UndoResult = pvp.undo();
if (stopped.status !== "success" || undone.status !== "rejected" || undone.reason !== "no_history") {
  throw new Error("CommonJS lifecycle results are broken");
}
pvp.dispose();
if (pvp.getSnapshot().phase !== "disposed") throw new Error("CommonJS disposal is broken");
