import { describe, expect, it, vi } from 'vitest'
import { ContextEngine } from '../ContextEngine'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '../fecha'
import type { LoadersPorScope } from '../loaders'

// Loaders falsos: ContextEngine no toca la red en ninguno de estos tests.
const loadersFalsos: LoadersPorScope = {
  identity: async (userId) => ({ materias: [{ id: 'm1', nombre: 'Cálculo II' }], nombresDeMateria: ['Cálculo II'], userId }),
  schedule: async () => ({ bloques: [], hoy: '2026-07-28', zonaHoraria: 'America/Bogota' }),
}

describe('ContextEngine — scopes', () => {
  it('sin scopes devuelve el contexto mínimo y NO lanza (a diferencia del stub anterior)', async () => {
    const engine = new ContextEngine(loadersFalsos)
    const ctx = await engine.build({ userId: 'u1', scopes: [] })
    expect(ctx.userId).toBe('u1')
    expect(typeof ctx.generatedAt).toBe('number')
    expect(ctx.identity).toBeUndefined()
    expect(ctx.schedule).toBeUndefined()
  })

  it('carga solo los scopes pedidos, no todos los disponibles', async () => {
    const engine = new ContextEngine(loadersFalsos)
    const ctx = await engine.build({ userId: 'u1', scopes: ['identity'] })
    expect(ctx.identity).toBeDefined()
    expect(ctx.schedule).toBeUndefined()
  })

  it('carga varios scopes a la vez', async () => {
    const engine = new ContextEngine(loadersFalsos)
    const ctx = await engine.build({ userId: 'u1', scopes: ['identity', 'schedule'] })
    expect((ctx.identity as { nombresDeMateria: string[] }).nombresDeMateria).toEqual(['Cálculo II'])
    expect((ctx.schedule as { hoy: string }).hoy).toBe('2026-07-28')
  })

  it('le pasa el userId a cada loader', async () => {
    const espia = vi.fn(async () => ({ ok: true }))
    const engine = new ContextEngine({ identity: espia })
    await engine.build({ userId: 'usuario-42', scopes: ['identity'] })
    expect(espia).toHaveBeenCalledWith('usuario-42')
  })

  it('un scope pedido dos veces se carga una sola vez', async () => {
    const espia = vi.fn(async () => ({ ok: true }))
    const engine = new ContextEngine({ identity: espia })
    await engine.build({ userId: 'u1', scopes: ['identity', 'identity'] })
    expect(espia).toHaveBeenCalledTimes(1)
  })

  it('carga los scopes en PARALELO, no en serie', async () => {
    const orden: string[] = []
    const lento = async () => {
      orden.push('lento:inicio')
      await new Promise((r) => setTimeout(r, 30))
      orden.push('lento:fin')
      return {}
    }
    const rapido = async () => {
      orden.push('rapido:inicio')
      return {}
    }
    const engine = new ContextEngine({ identity: lento, schedule: rapido })
    await engine.build({ userId: 'u1', scopes: ['identity', 'schedule'] })
    // Si fueran en serie, 'rapido:inicio' iría después de 'lento:fin'.
    expect(orden).toEqual(['lento:inicio', 'rapido:inicio', 'lento:fin'])
  })
})

describe('ContextEngine — scopes sin implementar', () => {
  it('pedir un scope sin loader lanza AINotImplementedError (fallar fuerte, no fingir vacío)', async () => {
    const engine = new ContextEngine(loadersFalsos)
    await expect(engine.build({ userId: 'u1', scopes: ['habits'] })).rejects.toMatchObject({ code: 'AI_NOT_IMPLEMENTED' })
  })

  it('el mensaje dice qué scope falta y cuáles hay', async () => {
    const engine = new ContextEngine(loadersFalsos)
    await expect(engine.build({ userId: 'u1', scopes: ['academic'] })).rejects.toThrow(/academic/)
    await expect(engine.build({ userId: 'u1', scopes: ['academic'] })).rejects.toThrow(/identity, schedule/)
  })

  it('un scope no implementado invalida la construcción aunque otro sí exista', async () => {
    const engine = new ContextEngine(loadersFalsos)
    await expect(engine.build({ userId: 'u1', scopes: ['identity', 'operational'] })).rejects.toMatchObject({
      code: 'AI_NOT_IMPLEMENTED',
    })
  })

  it('no llama a ningún loader si algún scope pedido no existe', async () => {
    const espia = vi.fn(async () => ({}))
    const engine = new ContextEngine({ identity: espia })
    await expect(engine.build({ userId: 'u1', scopes: ['identity', 'habits'] })).rejects.toThrow()
    expect(espia).not.toHaveBeenCalled()
  })

  it('si un loader falla, el error se propaga sin enmascararse', async () => {
    const engine = new ContextEngine({ identity: async () => { throw new Error('supabase caído') } })
    await expect(engine.build({ userId: 'u1', scopes: ['identity'] })).rejects.toThrow('supabase caído')
  })
})

describe('ContextEngine — scopesDisponibles', () => {
  it('reporta los scopes con loader (lo que consume /api/ai/health)', () => {
    expect(new ContextEngine(loadersFalsos).scopesDisponibles().sort()).toEqual(['identity', 'schedule'])
  })
})

describe('hoyEnZona', () => {
  it('devuelve YYYY-MM-DD', () => {
    expect(hoyEnZona(new Date('2026-07-28T15:00:00Z'), 'America/Bogota')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la zona horaria cambia el día, no solo la hora — el caso que motivó todo esto', () => {
    // 2026-07-29 02:00 UTC es todavía 28 de julio en Bogotá (UTC-5).
    const instante = new Date('2026-07-29T02:00:00Z')
    expect(hoyEnZona(instante, 'America/Bogota')).toBe('2026-07-28')
    expect(hoyEnZona(instante, 'UTC')).toBe('2026-07-29')
  })

  it('cruza al día siguiente en husos adelantados', () => {
    // 2026-07-28 20:00 UTC ya es 29 en Tokio (UTC+9).
    expect(hoyEnZona(new Date('2026-07-28T20:00:00Z'), 'Asia/Tokyo')).toBe('2026-07-29')
  })

  it('una zona inválida cae a UTC en vez de lanzar', () => {
    expect(hoyEnZona(new Date('2026-07-28T15:00:00Z'), 'No/Existe')).toBe('2026-07-28')
  })

  it('la zona por defecto es una IANA válida', () => {
    expect(hoyEnZona(new Date('2026-07-28T15:00:00Z'), ZONA_HORARIA_POR_DEFECTO)).toBe('2026-07-28')
  })
})
