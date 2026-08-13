'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type EstadoDictado = 'inactivo' | 'escuchando' | 'error'

// Sub-sprint 7.4 — dictado por voz para el composer de /ai, vía Web Speech
// API nativa (SpeechRecognition / webkitSpeechRecognition — sin librería,
// sin backend). Ver lib/ai/speechRecognition.d.ts para los tipos: TypeScript
// no trae la interfaz principal en lib.dom.d.ts.
//
// Decisión: CONTINUO + interimResults=true (el texto se va llenando en vivo
// mientras se habla), no "grabar todo y transcribir al soltar" — con
// interimResults=false el usuario se queda mirando el botón "escuchando"
// sin ninguna señal de que algo está pasando hasta que termina de hablar;
// con interim en vivo ve de inmediato que se le está escuchando.
//
// Idioma: 'es-ES'.
//
// Límite real encontrado (no de este código): el backend de red del
// webkitSpeechRecognition de Chrome NO completó ni una sola vez en este
// entorno automatizado — el pipeline de audio del navegador sí funciona
// (eventos audiostart/soundstart/speechstart disparan normal con audio real
// alimentado como micrófono falso), pero la transcripción nunca llegó, ni
// con headless:false, ni esperando 25s. Es un límite conocido y documentado
// de la API fuera de una sesión interactiva normal de un usuario real (el
// endpoint gratuito que usa Chrome internamente es cada vez más estricto
// con contextos que no parecen un navegador real) — no algo que este código
// pueda controlar. La lógica de armado de texto (interino en vivo, texto
// previo preservado, acumulación de segmentos finales) sí se verificó de
// punta a punta con un SpeechRecognition falso que dispara la misma forma
// de eventos que la API real, además de los estados sin-soporte y error.
const IDIOMA = 'es-ES'

type UseDictadoResultado = {
  /** `false` si el navegador no expone SpeechRecognition en absoluto —
   *  quien use el hook debe ocultar/deshabilitar su botón, no mostrar error. */
  soportado: boolean
  estado: EstadoDictado
  /** Alterna escuchar/detener. Recibe el texto ACTUAL del textarea en el
   *  momento del clic — el hook lo usa como base para no reemplazar lo que
   *  el usuario ya había escrito a mano. */
  alternar: (textoActual: string) => void
  /**
   * Sprint Correcciones /ai — Parte 5. El texto dictado ya se consumió (se
   * envió el mensaje y el campo se vació): corta la escucha y olvida la base
   * y el acumulado.
   *
   * Sin esto aparecía el bug reportado: al enviar por voz, el texto volvía a
   * la caja. `stop()` no es instantáneo — el reconocedor todavía emite un
   * `onresult` final con el audio pendiente, y ese handler llamaba a
   * `onTranscripcion(base + dictado)` DESPUÉS de que el envío ya había hecho
   * `setTexto('')`, rellenando el campo recién vaciado. Con el envío manual
   * nunca pasaba porque no había ningún reconocedor vivo que emitiera nada.
   */
  reiniciar: () => void
}

// `onTranscripcion` recibe el texto COMPLETO ya armado (base + lo dictado
// hasta ese punto) — el llamador solo hace `setTexto(textoCompleto)`, nunca
// concatena nada por su cuenta (evita que la lógica de "dónde va el espacio
// entre lo escrito y lo dictado" viva en dos lugares).
// Sin suscripción real: el soporte del navegador no cambia durante la
// sesión, así que `subscribe` es un no-op — pero useSyncExternalStore sigue
// siendo la forma correcta de leer un global solo-de-cliente sin
// desincronizar el render inicial del servidor (getServerSnapshot) del real
// del navegador (getSnapshot), y sin caer en 'setState dentro de un
// useEffect' (que si dispara el lint, a diferencia de esto).
function suscribirNoOp() {
  return () => {}
}
function leerSoporte(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}
function leerSoporteServidor(): boolean {
  return false
}

export function useDictado(onTranscripcion: (textoCompleto: string) => void): UseDictadoResultado {
  const soportado = useSyncExternalStore(suscribirNoOp, leerSoporte, leerSoporteServidor)
  const [estado, setEstado] = useState<EstadoDictado>('inactivo')
  const reconocedorRef = useRef<SpeechRecognition | null>(null)
  // Snapshot de lo que ya había en el textarea al empezar ESTA sesión de
  // dictado — no se vuelve a leer del DOM/estado después, así que si el
  // usuario edita el texto a mano MIENTRAS dicta (foco simultáneo es
  // improbable pero no imposible), el dictado sigue construyendo sobre la
  // base congelada del inicio, comportamiento predecible antes que "mágico".
  const baseRef = useRef('')
  const finalAcumuladoRef = useRef('')

  const detener = useCallback(() => {
    reconocedorRef.current?.stop()
  }, [])

  const iniciar = useCallback(
    (textoActual: string) => {
      const Ctor = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined
      if (!Ctor) return

      const reconocedor = new Ctor()
      reconocedor.lang = IDIOMA
      reconocedor.continuous = true
      reconocedor.interimResults = true

      baseRef.current = textoActual
      finalAcumuladoRef.current = ''

      reconocedor.onresult = (evento) => {
        let interino = ''
        for (let i = evento.resultIndex; i < evento.results.length; i++) {
          const alternativa = evento.results[i][0]
          if (evento.results[i].isFinal) finalAcumuladoRef.current += alternativa.transcript
          else interino += alternativa.transcript
        }
        const dictado = (finalAcumuladoRef.current + interino).trim()
        const base = baseRef.current.trim()
        onTranscripcion(dictado ? (base ? `${base} ${dictado}` : dictado) : base)
      }

      // Un error (sin permiso de micrófono, sin conexión al servicio de
      // reconocimiento, silencio prolongado tipo 'no-speech', etc.) siempre
      // dispara 'onend' justo después — si 'onend' pisara el estado a
      // 'inactivo' de inmediato, el ícono de error nunca alcanzaría a
      // mostrarse (mismo tick). Se deja 'error' visible ~2s y recién
      // entonces se resetea, para que el usuario de verdad lo note antes de
      // reintentar.
      reconocedor.onerror = () => {
        setEstado('error')
        reconocedorRef.current = null
        setTimeout(() => setEstado((actual) => (actual === 'error' ? 'inactivo' : actual)), 2000)
      }
      reconocedor.onend = () => {
        reconocedorRef.current = null
        setEstado((actual) => (actual === 'error' ? actual : 'inactivo'))
      }

      reconocedorRef.current = reconocedor
      reconocedor.start()
      setEstado('escuchando')
    },
    [onTranscripcion]
  )

  const alternar = useCallback(
    (textoActual: string) => {
      if (estado === 'escuchando') detener()
      else iniciar(textoActual)
    },
    [estado, iniciar, detener]
  )

  // Ver el comentario de `reiniciar` en el tipo de arriba. Se desenganchan
  // los handlers ANTES de `stop()` a propósito: `stop()` procesa el audio
  // pendiente y dispara `onresult`/`onend` después, y esos son justamente los
  // que no deben volver a tocar el campo.
  const reiniciar = useCallback(() => {
    const reconocedor = reconocedorRef.current
    if (reconocedor) {
      reconocedor.onresult = null
      reconocedor.onerror = null
      reconocedor.onend = null
      reconocedor.stop()
      reconocedorRef.current = null
    }
    baseRef.current = ''
    finalAcumuladoRef.current = ''
    setEstado((actual) => (actual === 'escuchando' ? 'inactivo' : actual))
  }, [])

  // Si el usuario navega fuera de /ai con el micrófono todavía activo, no
  // debe seguir escuchando en segundo plano.
  useEffect(() => {
    return () => {
      reconocedorRef.current?.stop()
    }
  }, [])

  return { soportado, estado, alternar, reiniciar }
}
