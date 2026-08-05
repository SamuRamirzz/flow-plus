export type ModelId = string
export type AIProviderId = string
export type Confidence = number

export type AutonomyLevel =
  | 'autonomous'
  | 'autonomous_reversible'
  | 'suggested_confirmation_required'

export type ExecutionQueue = 'interactive' | 'deferred' | 'batch'

export type JSONSchema = Record<string, unknown>
