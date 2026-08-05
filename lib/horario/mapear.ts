import type { BloqueHorario, DiaSemana } from './tipos'

// Forma de una fila de la tabla `horario` tal como la devuelve Supabase
// (snake_case) — el mapeo a BloqueHorario (camelCase) vive en un solo
// lugar para que el cliente (lib/horario/cargar.ts) y el servidor
// (lib/server/horario.ts) no dupliquen esta traducción cada uno por su
// lado.
export type FilaHorario = {
  id: string
  materia_id: string
  dia_semana: number
  hora_inicio: string | null
  hora_fin: string | null
  aula: string | null
  profesor: string | null
}

// PURA. Postgres devuelve una columna `time` como 'HH:MM:SS', pero TODO el
// resto del proyecto trabaja con 'HH:MM' (el tipo BloqueHorario lo declara
// así, `<input type="time">` lo emite así, y el agente de visión lo extrae
// así). Sin recortar los segundos acá, un bloque guardado a las '07:00:00'
// y el mismo bloque leído de una foto como '07:00' se comparan como
// distintos: el diff del Sprint 8 los reportaba como 11 "movidos" al
// reimportar la MISMA foto (verificado, no hipotético), y la grilla
// mostraba "07:00:00 – 09:00:00".
//
// Se corrige en el mapeo y no en el diff a propósito: es el único punto por
// el que pasan las filas de la base hacia el resto de la app, así que
// arregla de una vez la comparación, lo que se muestra y cualquier futuro
// consumidor, en vez de parchear cada uno por separado.
export function normalizarHora(hora: string | null): string | null {
  if (!hora) return null
  const m = /^(\d{2}:\d{2})(:\d{2})?/.exec(hora)
  return m ? m[1] : hora
}

export function filaABloqueHorario(fila: FilaHorario): BloqueHorario {
  return {
    id: fila.id,
    materiaId: fila.materia_id,
    diaSemana: fila.dia_semana as DiaSemana,
    horaInicio: normalizarHora(fila.hora_inicio),
    horaFin: normalizarHora(fila.hora_fin),
    aula: fila.aula,
    profesor: fila.profesor,
  }
}
