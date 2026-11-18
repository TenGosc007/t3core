/** Draft configuration boundary; instance lifecycle types already use runtime. */
import type { AivsAiInstance, PvPInstance, SinglePlayerInstance } from "../types";
import type { AivsAiOptions, PvpOptions, SinglePlayerOptions } from "./options";

export type { AivsAiInstance, PvPInstance, SinglePlayerInstance } from "../types";

export interface TicTacToeConstructor {
  new (options: PvpOptions): PvPInstance;
  new (options: SinglePlayerOptions): SinglePlayerInstance;
  new (options: AivsAiOptions): AivsAiInstance;
}
