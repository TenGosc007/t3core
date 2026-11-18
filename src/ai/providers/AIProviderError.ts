/** Optional structured failures for lazy initialization and provider time budgets. */
export class AIProviderError extends Error {
  constructor(
    readonly code: "ai_initialization_failed" | "ai_timeout",
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
