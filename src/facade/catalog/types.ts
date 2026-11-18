import type { AIEngineMetadata, AIProvider } from "@/ai/providers/types";
import type { VariantDescriptor, VariantId } from "@/game/contracts";
import type { SessionMode } from "@/sessions/state/types";

export type CapabilitiesOptions = {
  readonly variant?: VariantId;
  readonly aiProviders?: readonly AIProvider[];
};

export type GameCapabilities = {
  readonly variant: VariantDescriptor;
  readonly modes: readonly SessionMode[];
  readonly defaultAIEngine: string | null;
  readonly aiEngines: readonly Omit<AIEngineMetadata, "supportedVariants">[];
};
