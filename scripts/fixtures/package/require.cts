import core = require("t3core");

async function verifyRequire() {
  if (Object.keys(core).sort().join() !== "AIProviderError,TicTacToe") {
    throw new Error("Unexpected CommonJS public exports");
  }
  const capabilities: core.GameCapabilities = core.TicTacToe.getCapabilities();
  if (capabilities.defaultAIEngine !== "alphabeta" || !Object.isFrozen(capabilities)) {
    throw new Error("CommonJS capability discovery does not work");
  }
  const timeout = new core.AIProviderError("ai_timeout", "Search budget exhausted");
  if (timeout.code !== "ai_timeout") throw new Error("Provider errors are unavailable");
  const pvp: core.PvPInstance = new core.TicTacToe({ mode: "pvp" });
  const { getSnapshot, subscribe } = pvp;
  const state: core.SnapshotFor<"pvp"> = getSnapshot();
  let notifications = 0;
  const unsubscribe = subscribe(() => { notifications++; });
  await pvp.start();
  unsubscribe();
  await pvp.restart();
  if (state.phase !== "idle" || notifications !== 1 || !Object.isFrozen(getSnapshot())) {
    throw new Error("CommonJS observation or cleanup is broken");
  }
  pvp.dispose();
  if (getSnapshot().phase !== "disposed") throw new Error("CommonJS disposal is broken");
}

void verifyRequire().catch((error) => { throw error; });
