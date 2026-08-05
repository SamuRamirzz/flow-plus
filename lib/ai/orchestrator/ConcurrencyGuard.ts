// Límite de ejecuciones concurrentes por clave (normalmente userId) y
// global (docs/ai-architecture/02-orchestrator.md §4.2.5) — evita que una
// carga masiva de eventos dispare N llamadas simultáneas sin control.
export class ConcurrencyGuard {
  private readonly activeByKey = new Map<string, number>()

  constructor(
    private readonly maxPerKey: number,
    private readonly maxGlobal: number
  ) {}

  private get globalActive(): number {
    let total = 0
    for (const count of this.activeByKey.values()) total += count
    return total
  }

  tryAcquire(key: string): boolean {
    if (this.globalActive >= this.maxGlobal) return false
    const current = this.activeByKey.get(key) ?? 0
    if (current >= this.maxPerKey) return false
    this.activeByKey.set(key, current + 1)
    return true
  }

  release(key: string): void {
    const current = this.activeByKey.get(key) ?? 0
    if (current <= 1) this.activeByKey.delete(key)
    else this.activeByKey.set(key, current - 1)
  }
}
