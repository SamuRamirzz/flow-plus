export type ParseResult<TOutput> = { ok: true; data: TOutput } | { ok: false; error: string }

export interface OutputParser<TOutput = unknown> {
  parse(raw: unknown): ParseResult<TOutput>
}
