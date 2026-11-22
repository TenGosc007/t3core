import type { AIEngineMetadata, AIProvider } from "@/ai/providers/types";
import type { VariantDescriptor, VariantId } from "@/game/contracts";
import type { SessionMode } from "@/sessions/state/types";

/** Variant and additional providers to inspect without creating AI strategies. */
export type CapabilitiesOptions = {
  /** Variant to inspect; defaults to classic-3x3. */
  readonly variant?: VariantId;
  /** Additional providers included alongside built-ins for this query only. */
  readonly aiProviders?: readonly AIProvider[];
};

/** Frozen metadata describing available play modes and compatible AI engines. */
export type GameCapabilities = {
  /** Resolved metadata for the queried variant. */
  readonly variant: VariantDescriptor;
  /** Supported modes; a variant without compatible AI engines exposes only pvp. */
  readonly modes: readonly SessionMode[];
  /** alphabeta when compatible, otherwise null; custom engines are never implicit defaults. */
  readonly defaultAIEngine: string | null;
  /** Compatible engine metadata only; contains no factories or engine instances. */
  readonly aiEngines: readonly Omit<AIEngineMetadata, "supportedVariants">[];
};
