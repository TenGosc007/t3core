import type { TicTacToeOptions } from "./options";
import type { AIProvider } from "@/ai/providers/types";

type Options = TicTacToeOptions<readonly AIProvider[]>;

const COMMON_KEYS = ["mode", "variant", "aiProviders"] as const;
/** Fields typed as optional `never` in other modes, so TypeScript allows undefined. */
const MODE_KEYS: readonly string[] = ["humanSymbol", "ai", "aiPlayers"];

/** Guard JavaScript callers as well as declarations; unknown options are errors. */
export function validateOptions(options: Options): void {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("Game options must be an object.");
  }
  const allowed: readonly string[] = [...COMMON_KEYS, ...validateModeOptions(options)];
  for (const [key, value] of Object.entries(options)) {
    if (allowed.includes(key)) continue;
    // Another mode's field set to undefined is treated as omitted.
    if (value === undefined && MODE_KEYS.includes(key)) continue;
    throw new TypeError("Unsupported game option: " + key);
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
    case "aivsai": {
      // Holes and undefined slots would otherwise fall back to the default engine.
      const players: unknown = options.aiPlayers;
      if (!Array.isArray(players) || players.length !== 2 ||
          players[0] === undefined || players[1] === undefined) {
        throw new TypeError("AI-vs-AI requires two player configurations.");
      }
      return ["aiPlayers"];
    }
    default:
      throw new RangeError("Unsupported game mode.");
  }
}
