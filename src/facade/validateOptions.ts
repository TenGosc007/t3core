import type { TicTacToeOptions } from "./options";
import type { AIProvider } from "@/ai/providers/types";

/** Guard JavaScript callers as well as declarations; unknown options are errors. */
export function validateOptions(options: TicTacToeOptions<readonly AIProvider[]>): void {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("Game options must be an object.");
  }
  const allowed = ["mode", "variant", "aiProviders"];
  switch (options.mode) {
    case "pvp": break;
    case "singleplayer":
      allowed.push("humanSymbol", "ai");
      if (options.humanSymbol !== undefined && options.humanSymbol !== "O" && options.humanSymbol !== "X") {
        throw new RangeError("Human symbol must be O or X.");
      }
      break;
    case "aivsai":
      allowed.push("aiPlayers");
      if (!Array.isArray(options.aiPlayers) || options.aiPlayers.length !== 2) {
        throw new TypeError("AI-vs-AI requires two player configurations.");
      }
      break;
    default: throw new RangeError("Unsupported game mode.");
  }
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new TypeError("Unsupported game option: " + key);
  }
  if (options.variant !== undefined && typeof options.variant !== "string") {
    throw new TypeError("Variant must be a string identifier.");
  }
  if (options.aiProviders !== undefined && !Array.isArray(options.aiProviders)) {
    throw new TypeError("aiProviders must be an array.");
  }
}
