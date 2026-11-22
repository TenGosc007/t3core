import type { TicTacToeOptions } from "./options";
import type { AIProvider } from "@/ai/providers/types";

type Options = TicTacToeOptions<readonly AIProvider[]>;

const COMMON_KEYS = ["mode", "variant", "aiProviders"] as const;

/** Guard JavaScript callers as well as declarations; unknown options are errors. */
export function validateOptions(options: Options): void {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("Game options must be an object.");
  }
  const allowed: readonly string[] = [...COMMON_KEYS, ...validateModeOptions(options)];
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

/** Validate mode-specific fields and return the extra keys that mode allows. */
function validateModeOptions(options: Options): readonly string[] {
  switch (options.mode) {
    case "pvp":
      return [];
    case "singleplayer":
      if (options.humanSymbol !== undefined && options.humanSymbol !== "O" && options.humanSymbol !== "X") {
        throw new RangeError("Human symbol must be O or X.");
      }
      return ["humanSymbol", "ai"];
    case "aivsai":
      if (!Array.isArray(options.aiPlayers) || options.aiPlayers.length !== 2) {
        throw new TypeError("AI-vs-AI requires two player configurations.");
      }
      return ["aiPlayers"];
    default:
      throw new RangeError("Unsupported game mode.");
  }
}
