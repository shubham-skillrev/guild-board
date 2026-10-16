/** What every model call asks for: JSON back against a schema. */
export interface AiJsonArgs {
  system: string
  prompt: string
  /** JSON Schema: object, array, string, number, boolean, enum. */
  schema: Record<string, unknown>
  /** Names the caller in logs. */
  label: string
  /** 'quality' for judgement, 'bulk' for many small mechanical items. */
  tier?: 'quality' | 'bulk'
  /**
   * Longest wait for one model before moving to the next. Defaults to 40s
   * for quality and 90s for bulk (big batches). Set it lower where a person
   * is watching a spinner.
   */
  timeoutMs?: number
}

/** One failed attempt. `transient` means another model is worth trying. */
export class AiCallError extends Error {
  readonly transient: boolean
  constructor(message: string, transient: boolean) {
    super(message)
    this.transient = transient
  }
}
