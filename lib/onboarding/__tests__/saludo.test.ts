import { describe, it, expect } from 'vitest'
import {
  metadataDeClaims,
  nombreParaSaludo,
  nombreCompletoDeClaims,
  textoSaludo,
  subtituloSaludo,
  msSaludo,
  destinoSeguro,
  MS_SALUDO_PRIMERA_VEZ,
  MS_SALUDO_DE_VUELTA,
} from '../saludo'
import { RUTA_APP } from '@/lib/rutas'

describe('metadataDeClaims', () => {
  it('saca user_metadata de unos claims normales', () => {
    expect(metadataDeClaims({ sub: 'abc', user_metadata: { full_name: 'Samuel Ramírez' } })).toEqual({ full_name: 'Samuel Ramírez' })
  })

  it('devuelve null ante cualquier forma inesperada, sin lanzar', () => {
    // Son datos de un JWT: todo esto es una entrada posible.
    expect(metadataDeClaims(null)).toBeNull()
    expect(metadataDeClaims(undefined)).toBeNull()
    expect(metadataDeClaims('no soy un objeto')).toBeNull()
    expect(metadataDeClaims(42)).toBeNull()
    expect(metadataDeClaims({})).toBeNull()
    expect(metadataDeClaims({ user_metadata: null })).toBeNull()
    expect(metadataDeClaims({ user_metadata: 'texto' })).toBeNull()
  })
})

describe('nombreParaSaludo', () => {
  it('devuelve solo el primer nombre', () => {
    expect(nombreParaSaludo({ full_name: 'Samuel Ramírez' })).toBe('Samuel')
  })

  it('prefiere full_name sobre name cuando están los dos', () => {
    expect(nombreParaSaludo({ full_name: 'Samuel Ramírez', name: 'Otro' })).toBe('Samuel')
  })

  it('cae a name si no hay full_name — es lo que manda Google en algunos casos', () => {
    expect(nombreParaSaludo({ name: 'Ana Pérez' })).toBe('Ana')
  })

  it('devuelve null sin metadata o sin nombre: es el caso REAL de un alta por magic link', () => {
    expect(nombreParaSaludo(null)).toBeNull()
    expect(nombreParaSaludo(undefined)).toBeNull()
    expect(nombreParaSaludo({})).toBeNull()
    expect(nombreParaSaludo({ full_name: 123 })).toBeNull()
  })

  it('trata un nombre en blanco como ausente', () => {
    expect(nombreParaSaludo({ full_name: '   ' })).toBeNull()
    expect(nombreParaSaludo({ full_name: '' })).toBeNull()
  })

  it('descarta un primer nombre absurdamente largo en vez de romper el layout', () => {
    expect(nombreParaSaludo({ full_name: 'A'.repeat(25) })).toBeNull()
    expect(nombreParaSaludo({ full_name: 'A'.repeat(24) })).toBe('A'.repeat(24))
  })

  it('aguanta espacios de más alrededor y entre nombres', () => {
    expect(nombreParaSaludo({ full_name: '  Samuel   Ramírez  ' })).toBe('Samuel')
  })
})

describe('nombreCompletoDeClaims', () => {
  it('devuelve el nombre entero, para persistirlo en perfil_academico', () => {
    expect(nombreCompletoDeClaims({ user_metadata: { full_name: 'Samuel Ramírez' } })).toBe('Samuel Ramírez')
  })

  it('normaliza los espacios internos', () => {
    expect(nombreCompletoDeClaims({ user_metadata: { full_name: '  Samuel    Ramírez ' } })).toBe('Samuel Ramírez')
  })

  it('devuelve null cuando no hay nada que guardar', () => {
    expect(nombreCompletoDeClaims({ user_metadata: {} })).toBeNull()
    expect(nombreCompletoDeClaims(null)).toBeNull()
  })

  it('descarta un nombre desmedido antes de escribirlo en la base', () => {
    expect(nombreCompletoDeClaims({ user_metadata: { full_name: 'A'.repeat(81) } })).toBeNull()
  })
})

describe('textoSaludo', () => {
  it('primera vez: el mismo texto sin importar si hay nombre', () => {
    expect(textoSaludo(true, 'Samuel')).toBe('Así que es tu primera vez, ¿eh?')
    expect(textoSaludo(true, null)).toBe('Así que es tu primera vez, ¿eh?')
  })

  it('de vuelta: usa el nombre si lo hay', () => {
    expect(textoSaludo(false, 'Samuel')).toBe('Qué bueno tenerte de vuelta, Samuel')
  })

  it('de vuelta sin nombre: sigue siendo una frase completa, no cuelga una coma', () => {
    expect(textoSaludo(false, null)).toBe('Qué bueno tenerte de vuelta')
  })

  it('ninguna variante lleva género gramatical — el registro es abierto y multiusuario', () => {
    const todos = [textoSaludo(true, 'Ana'), textoSaludo(false, 'Ana'), textoSaludo(false, null)]
    for (const t of todos) {
      expect(t).not.toMatch(/bienvenid[oa]\b/i)
    }
  })
})

describe('subtituloSaludo / msSaludo', () => {
  it('anticipa el carrusel solo en la primera vez', () => {
    expect(subtituloSaludo(true)).toContain('Flow+')
    expect(subtituloSaludo(false)).toBe('Abriendo tu agenda…')
  })

  it('el usuario que vuelve espera menos que el que llega por primera vez', () => {
    expect(msSaludo(false)).toBe(MS_SALUDO_DE_VUELTA)
    expect(msSaludo(true)).toBe(MS_SALUDO_PRIMERA_VEZ)
    expect(msSaludo(false)).toBeLessThan(msSaludo(true))
  })
})

describe('destinoSeguro', () => {
  it('deja pasar una ruta interna normal', () => {
    expect(destinoSeguro('/horario')).toBe('/horario')
    expect(destinoSeguro('/ai')).toBe('/ai')
  })

  it('cae a la app cuando no hay nada', () => {
    expect(destinoSeguro(null)).toBe(RUTA_APP)
    expect(destinoSeguro(undefined)).toBe(RUTA_APP)
    expect(destinoSeguro('')).toBe(RUTA_APP)
  })

  it('bloquea el open redirect a un dominio ajeno', () => {
    // El peor momento posible para mandar a alguien fuera es justo después
    // de que se autentica.
    expect(destinoSeguro('https://malicioso.example')).toBe(RUTA_APP)
    expect(destinoSeguro('//malicioso.example')).toBe(RUTA_APP)
    expect(destinoSeguro('http://malicioso.example/x')).toBe(RUTA_APP)
  })

  it('nunca devuelve al propio flujo de entrada — sería un bucle', () => {
    expect(destinoSeguro('/bienvenida')).toBe(RUTA_APP)
    expect(destinoSeguro('/login')).toBe(RUTA_APP)
    expect(destinoSeguro('/login/algo')).toBe(RUTA_APP)
  })

  it('`/` es la landing, no la app: quien acaba de entrar va a su agenda', () => {
    // Un enlace viejo (o el `volverA=/` que dejaba el proxy antes de la
    // reorganización) no debe dejar al usuario en la página de marca justo
    // después de iniciar sesión.
    expect(destinoSeguro('/')).toBe(RUTA_APP)
  })

  it('la app NO es la raíz — si vuelve a serlo, este test avisa', () => {
    // Sprint Home: RUTA_APP pasó de /agenda a /home (Home es ahora el
    // destino post-login, decisión explícita del usuario — ver el
    // comentario extendido en lib/rutas.ts). Este test solo protege contra
    // "vuelve a ser /", no contra futuros cambios deliberados de cuál
    // sección específica es la app — por eso solo verifica que no sea '/'.
    expect(RUTA_APP).not.toBe('/')
  })

  it('conserva query string y fragmento de una ruta interna', () => {
    expect(destinoSeguro('/horario?dia=3')).toBe('/horario?dia=3')
  })
})
