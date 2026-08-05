'use client'

import { useEffect, useState } from 'react'
import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { cargarHorario } from '@/lib/horario/cargar'
import { filaABloqueHorario, type FilaHorario } from '@/lib/horario/mapear'
import { cargarMaterias, cargarTareas } from '@/lib/tasks'
import { useRealtimeSync } from '@/lib/useRealtimeSync'
import { reconciliar } from '@/lib/realtimeReconciliar'

export type DatosAgenda = {
  materias: Materia[]
  tareas: Tarea[]
  horario: BloqueHorario[]
  cargando: boolean
  // Sprint Home — expuesto para que `AgendaHome` (la única pantalla con
  // mutaciones) pueda refrescar el MISMO estado que ya devuelve este hook
  // tras crear/toggle/borrar/editar/fusionar, en vez de mantener una copia
  // local aparte que habría que sincronizar a mano con esta. Solo trae
  // materias+tareas de nuevo (no horario: ninguna de esas mutaciones lo
  // cambia) — mismo patrón "fetch-refetch total" que ya documentaba
  // PROJECT_CONTEXT.md antes de este sprint.
  recargar: () => Promise<void>
}

// Sprint Home — la carga de materias/tareas/horario ya no vive en un solo
// componente: `/agenda` (mutaciones completas) y `/home` (solo lectura —
// pulso del día + informes) son ahora DOS páginas separadas que necesitan
// los mismos tres datos. En vez de copiar el mismo `useEffect` con su
// bandera `activo` dos veces —lo bastante largo, y con un detalle fácil de
// perder si se copia a mano (esa bandera es justo lo que evita el error de
// lint `react-hooks/set-state-in-effect`, ver lib/useMontado.ts para el
// mismo razonamiento aplicado a otro caso)— se extrae acá una vez.
//
// `/home` usa `materias`/`tareas`/`horario`/`cargando` tal cual, sin llamar
// nunca a `recargar()` — no escribe tareas directamente, sus accesos
// rápidos NAVEGAN a /ai o /agenda para eso, no duplican el formulario.
export function useDatosAgenda(): DatosAgenda {
  const [materias, setMaterias] = useState<Materia[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [horario, setHorario] = useState<BloqueHorario[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    ;(async () => {
      const [mData, tData, hData] = await Promise.all([cargarMaterias(), cargarTareas(), cargarHorario()])
      if (!activo) return
      setMaterias(mData)
      setTareas(tData)
      setHorario(hData)
      setCargando(false)
    })()
    return () => {
      activo = false
    }
  }, [])

  async function recargar() {
    const [mData, tData] = await Promise.all([cargarMaterias(), cargarTareas()])
    setMaterias(mData)
    setTareas(tData)
  }

  // Sincronización en tiempo real entre dispositivos — cubre /home Y
  // /agenda de una sola vez, ya que las dos consumen este mismo hook.
  // `activo: !cargando`: no tiene sentido reconciliar contra un estado que
  // todavía no terminó de llegar del fetch inicial. Idempotente por `id`
  // (ver reconciliar()), así que el eco de una escritura que el propio
  // dispositivo ya aplicó vía `recargar()` no duplica nada.
  useRealtimeSync<Tarea>('tareas', !cargando, (evento) => setTareas((actuales) => reconciliar(actuales, evento)))
  useRealtimeSync<Materia>('materias', !cargando, (evento) => setMaterias((actuales) => reconciliar(actuales, evento)))
  // `horario` llega en snake_case (fila cruda de Postgres) — se mapea a
  // BloqueHorario (camelCase) con el mismo mapeo puro que ya usa
  // lib/horario/cargar.ts, antes de reconciliar. Sin esto, un bloque
  // nuevo por Realtime tendría `materia_id` en vez de `materiaId` y
  // rompería silenciosamente todo lo que lee ese campo.
  useRealtimeSync<FilaHorario>('horario', !cargando, (evento) =>
    setHorario((actuales) => reconciliar(actuales, { tipo: evento.tipo, fila: filaABloqueHorario(evento.fila) }))
  )

  return { materias, tareas, horario, cargando, recargar }
}
