import type { Materia, Tarea } from '@/lib/types'
import { supabaseServer } from './supabaseServer'
import { ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { nombreCompletoDeClaims } from '@/lib/onboarding/saludo'
import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { PUNTOS_CLAVE_INFORME_AGENT_ID, type PuntosClaveInformeAgentOutput } from '@/lib/ai/agents/puntosClaveInforme'
import { datosParaIA } from '@/lib/informes/calcular'
import { puntosClaveFallback } from '@/lib/informes/textoFallback'
import type { DatosInforme, FilaArchivoInforme, FilaNotaInforme } from '@/lib/informes/tipos'

// Sprint 18a — La costura con I/O del informe. Todo el cálculo vive en
// lib/informes/ (puro); acá solo se cargan filas.

export type DatosCrudosInforme = {
  tareas: Tarea[]
  materias: Materia[]
  archivos: FilaArchivoInforme[]
  notas: FilaNotaInforme[]
  zonaHoraria: string
  nombreUsuario: string | null
}

/**
 * Carga TODO lo que el informe necesita, en paralelo.
 *
 * Se traen las tareas COMPLETAS (sin filtrar por rango en SQL) a propósito:
 * `calcularRacha` y `evaluarSuficiencia` necesitan el historial entero, y la
 * comparación con el periodo anterior también. La tabla es pequeña (decenas
 * a cientos de filas por usuario) — filtrar en SQL ahorraría poco y obligaría
 * a dos consultas más.
 *
 * `claims` es opcional: sirve para el fallback del nombre cuando
 * `perfil_academico.nombre` está NULL, que es un caso REAL y frecuente (ver
 * lib/onboarding/saludo.ts — el trigger que puebla el perfil es `after
 * insert` y no vuelve a correr si el usuario vincula Google después).
 */
export async function cargarDatosCrudosInforme(userId: string, claims: unknown): Promise<DatosCrudosInforme> {
  const [tareasRes, materiasRes, archivosRes, notasRes, perfilRes] = await Promise.all([
    supabaseServer.from('tareas').select('*').eq('user_id', userId).order('fecha_entrega'),
    supabaseServer.from('materias').select('*').eq('user_id', userId),
    supabaseServer.from('archivos').select('created_at, analizado_en').eq('user_id', userId),
    supabaseServer.from('notas').select('created_at').eq('user_id', userId),
    supabaseServer.from('perfil_academico').select('nombre, apellido, zona_horaria').eq('user_id', userId).maybeSingle(),
  ])

  const perfil = perfilRes.data as { nombre: string | null; apellido: string | null; zona_horaria: string } | null

  const nombrePerfil = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ').trim()
  const nombreUsuario = nombrePerfil.length > 0 ? nombrePerfil : nombreCompletoDeClaims(claims)

  return {
    tareas: (tareasRes.data ?? []) as Tarea[],
    materias: (materiasRes.data ?? []) as Materia[],
    archivos: (archivosRes.data ?? []) as FilaArchivoInforme[],
    notas: (notasRes.data ?? []) as FilaNotaInforme[],
    zonaHoraria: perfil?.zona_horaria ?? ZONA_HORARIA_POR_DEFECTO,
    nombreUsuario,
  }
}

/** Tope para la llamada a la IA: pasado esto, el informe sale con el fallback. */
const TIMEOUT_IA_MS = 12_000

/**
 * Genera la sección "Puntos clave". NUNCA LANZA y NUNCA devuelve vacío.
 *
 * Este es el punto donde se materializa la promesa del sprint: la IA es lo
 * único que puede fallar del informe, y su fallo no puede impedir que el PDF
 * se genere. Cualquier camino que no termine en un texto validado —
 * excepción, timeout, agente no registrado, cifra inventada — cae al texto
 * determinístico, que por construcción solo usa cifras de los propios datos.
 */
export async function generarPuntosClave(userId: string, datos: DatosInforme): Promise<{ texto: string[]; origen: 'ia' | 'fallback' }> {
  const fallback = puntosClaveFallback(datos)

  try {
    bootstrapAI()
    const resultado = await aiOrchestrator.execute<PuntosClaveInformeAgentOutput>(PUNTOS_CLAVE_INFORME_AGENT_ID, {
      id: createId('req'),
      agentId: PUNTOS_CLAVE_INFORME_AGENT_ID,
      userId,
      input: '',
      metadata: { datos: datosParaIA(datos) },
      signal: AbortSignal.timeout(TIMEOUT_IA_MS),
    })

    if (resultado.status !== 'success' || !resultado.output || resultado.output.puntos.length === 0) {
      console.warn('[informes] puntos clave por IA no disponibles, se usa el texto determinístico:', resultado.error?.message ?? resultado.status)
      return { texto: fallback, origen: 'fallback' }
    }

    return { texto: resultado.output.puntos, origen: 'ia' }
  } catch (error) {
    // `execute()` no debería lanzar, pero el try/catch cubre también el
    // bootstrap y el timeout — el informe se genera igual, pase lo que pase.
    console.error('[informes] excepción generando puntos clave:', error)
    return { texto: fallback, origen: 'fallback' }
  }
}
