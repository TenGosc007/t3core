/**
 * Structured failure thrown by a custom AI calculation. Sessions expose its
 * code/message as serializable error data and enter the error phase.
 * Time budgets belong to the provider; the core does not set a timeout.
 * @example
 * throw new AIProviderError("ai_timeout", "Search budget exceeded.");
 */
export class AIProviderError extends Error {
  /**
   * Describes a lazy initialization failure or a search timeout.
   * @param code - Failure category to preserve in the session action and snapshot.
   * @param message - Human-readable failure description.
   */
  constructor(
    /** Serializable initialization or timeout category. */
    readonly code: "ai_initialization_failed" | "ai_timeout",
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
