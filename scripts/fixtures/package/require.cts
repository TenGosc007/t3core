import core = require("t3core");

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
