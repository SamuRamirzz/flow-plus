import { describe, it, expect } from 'vitest'
import { MENU_PRINCIPAL, pideMenu, menuComoTexto, resolverOpcion, comandoDeOpcion, MAX_LARGO_TITULO } from '../menus'

describe('pideMenu', () => {
  it('reconoce las formas de pedir el menú', () => {
    for (const t of ['menu', 'menú', 'Menu', 'HOLA', 'hola!', 'buenas', ' inicio ', 'opciones', '¿opciones?']) {
      expect(pideMenu(t), t).toBe(true)
    }
  })

  it('NO se dispara con un mensaje real de trabajo', () => {
    // Si "hola" abriera el menú pero "hola, crea una tarea" también, el
    // usuario perdería el mensaje que de verdad quiso mandar.
    for (const t of ['hola crea una tarea', 'ensayo de historia para el viernes', '/tareas', 'holanda']) {
      expect(pideMenu(t), t).toBe(false)
    }
  })
})

describe('menuComoTexto — el fallback cuando los botones fallan', () => {
  it('numera todas las opciones y pide responder con el número', () => {
    const texto = menuComoTexto(MENU_PRINCIPAL)
    MENU_PRINCIPAL.opciones.forEach((o, i) => {
      expect(texto).toContain(`${i + 1}. ${o.titulo}`)
    })
    expect(texto).toContain('Responde con el número')
  })
})

describe('resolverOpcion', () => {
  it('acepta el id exacto (botón tocado)', () => {
    expect(resolverOpcion(MENU_PRINCIPAL, 'menu:horario')?.id).toBe('menu:horario')
  })

  it('acepta el número (usuario respondiendo al fallback de texto)', () => {
    expect(resolverOpcion(MENU_PRINCIPAL, '1')?.id).toBe(MENU_PRINCIPAL.opciones[0].id)
    expect(resolverOpcion(MENU_PRINCIPAL, ' 3 ')?.id).toBe(MENU_PRINCIPAL.opciones[2].id)
  })

  it('rechaza números fuera de rango y basura', () => {
    expect(resolverOpcion(MENU_PRINCIPAL, '0')).toBeNull()
    expect(resolverOpcion(MENU_PRINCIPAL, '99')).toBeNull()
    expect(resolverOpcion(MENU_PRINCIPAL, 'menu:inventado')).toBeNull()
    expect(resolverOpcion(MENU_PRINCIPAL, '')).toBeNull()
  })
})

describe('comandoDeOpcion', () => {
  it('cada opción del menú se traduce a un comando REAL ya existente', () => {
    // Esto es lo que garantiza que el botón y el comando escrito no puedan
    // divergir: el menú solo escribe el comando por ti.
    for (const o of MENU_PRINCIPAL.opciones) {
      const cmd = comandoDeOpcion(o.id)
      expect(cmd, o.id).not.toBeNull()
      expect(cmd!.startsWith('/'), o.id).toBe(true)
    }
  })

  it('devuelve null para un id desconocido', () => {
    expect(comandoDeOpcion('menu:inventado')).toBeNull()
  })
})

describe('límites reales de WhatsApp', () => {
  it('ningún título supera los 25 caracteres que admite un botón', () => {
    for (const o of MENU_PRINCIPAL.opciones) {
      expect(o.titulo.length, o.titulo).toBeLessThanOrEqual(MAX_LARGO_TITULO)
    }
  })
})
