import { describe, expect, it, vi, beforeEach } from 'vitest'

// Sprint Auth / Fase 4 — tests de la costura de identidad.
//
// Se mockea `./sesion` (el módulo que crea el cliente atado a las cookies), que
// es la costura correcta: así se prueba la LÓGICA de getUserId (qué considera
// una sesión válida, qué hace sin ella) sin tocar la red, sin Supabase y sin
// `cookies()` de next/headers — que no existe fuera de un request de Next.
//
// Es el mismo criterio que el resto del proyecto usa para los agentes: se
// inyecta un doble del proveedor en vez de llamar a Gemini de verdad.

const getClaims = vi.fn()

vi.mock('../sesion', () => ({
  clienteDeSesion: async () => ({ auth: { getClaims } }),
}))

const { getUserId, getUserIdOpcional, requerirUsuario, ErrorNoAutenticado } = await import('../usuario')

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

beforeEach(() => {
  getClaims.mockReset()
})

describe('getUserId — con sesión válida', () => {
  it('devuelve el `sub` de los claims', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: UUID } }, error: null })
    await expect(getUserId()).resolves.toBe(UUID)
  })

  it('llama a getClaims (no a getSession ni getUser)', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: UUID } }, error: null })
    await getUserId()
    expect(getClaims).toHaveBeenCalledTimes(1)
  })
})

describe('getUserId — sin sesión, falla de forma controlada', () => {
  it('lanza ErrorNoAutenticado si no hay claims', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    await expect(getUserId()).rejects.toBeInstanceOf(ErrorNoAutenticado)
  })

  it('lanza si getClaims devuelve error', async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: 'jwt expirado' } })
    await expect(getUserId()).rejects.toBeInstanceOf(ErrorNoAutenticado)
  })

  it('lanza si `sub` viene vacío — un string vacío NO es una identidad', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: '' } }, error: null })
    await expect(getUserId()).rejects.toBeInstanceOf(ErrorNoAutenticado)
  })

  it('lanza si `sub` no es string (defensa contra un claim manipulado)', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 12345 } }, error: null })
    await expect(getUserId()).rejects.toBeInstanceOf(ErrorNoAutenticado)
  })

  it('lanza si hay claims pero sin `sub`', async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: 'a@b.c' } }, error: null })
    await expect(getUserId()).rejects.toBeInstanceOf(ErrorNoAutenticado)
  })
})

describe('getUserIdOpcional', () => {
  it('devuelve el id con sesión', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: UUID } }, error: null })
    await expect(getUserIdOpcional()).resolves.toBe(UUID)
  })

  it('devuelve null sin sesión, sin lanzar', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    await expect(getUserIdOpcional()).resolves.toBeNull()
  })
})

describe('requerirUsuario — la puerta de los Route Handlers', () => {
  it('con sesión devuelve ok:true y el userId', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: UUID } }, error: null })
    const r = await requerirUsuario()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe(UUID)
  })

  it('sin sesión devuelve ok:false con una Response 401', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const r = await requerirUsuario()
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.respuesta.status).toBe(401)
      await expect(r.respuesta.json()).resolves.toEqual({ error: 'Necesitas iniciar sesión' })
    }
  })

  it('nunca lanza — el handler no necesita try/catch', async () => {
    getClaims.mockRejectedValue(new Error('la red explotó'))
    await expect(requerirUsuario()).resolves.toMatchObject({ ok: false })
  })
})

describe('la constante USUARIO_SIN_AUTH ya no existe', () => {
  it('no se exporta nada parecido desde el módulo', async () => {
    const modulo = await import('../usuario')
    expect(Object.keys(modulo)).not.toContain('USUARIO_SIN_AUTH')
  })
})
