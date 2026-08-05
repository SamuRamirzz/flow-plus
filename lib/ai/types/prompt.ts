export interface PromptTemplate<TVariables = Record<string, unknown>> {
  readonly id: string
  render(variables: TVariables): string
}
