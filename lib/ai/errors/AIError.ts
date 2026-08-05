export class AIError extends Error {
  readonly code: string

  constructor(message: string, code: string = 'AI_ERROR') {
    super(message)
    this.name = 'AIError'
    this.code = code
  }
}

export class AIConfigError extends AIError {
  constructor(message: string) {
    super(message, 'AI_CONFIG_ERROR')
    this.name = 'AIConfigError'
  }
}

export class AIProviderError extends AIError {
  constructor(message: string, readonly providerId?: string) {
    super(message, 'AI_PROVIDER_ERROR')
    this.name = 'AIProviderError'
  }
}

export class AIAgentError extends AIError {
  constructor(message: string, readonly agentId?: string) {
    super(message, 'AI_AGENT_ERROR')
    this.name = 'AIAgentError'
  }
}

export class AIValidationError extends AIError {
  constructor(message: string) {
    super(message, 'AI_VALIDATION_ERROR')
    this.name = 'AIValidationError'
  }
}

export class AITimeoutError extends AIError {
  constructor(message: string, readonly timeoutMs?: number) {
    super(message, 'AI_TIMEOUT_ERROR')
    this.name = 'AITimeoutError'
  }
}

export class AINotFoundError extends AIError {
  constructor(message: string) {
    super(message, 'AI_NOT_FOUND')
    this.name = 'AINotFoundError'
  }
}

export class AINotImplementedError extends AIError {
  constructor(message: string) {
    super(message, 'AI_NOT_IMPLEMENTED')
    this.name = 'AINotImplementedError'
  }
}
