'use client'

import type { ComponentType } from 'react'
import {
  IlustracionBienvenida,
  IlustracionConversacion,
  IlustracionHorario,
  IlustracionRecordatorios,
  IlustracionEmpezar,
} from './ilustraciones'

// Sprint Onboarding — el contenido de cada paso, separado del componente que
// lo dibuja para que agregar o quitar una pantalla sea editar esta lista y
// nada más.
//
// ───────────────────────────────────────────────────────────────────────────
// SON 5 PASOS, Y POR QUÉ NO 6
// ───────────────────────────────────────────────────────────────────────────
// El encargo sugería hasta 6 e incluía uno de "todo en un solo lugar:
// adelanto de Archivos y Notas", con la condición explícita de omitirlo si
// no está construido. Se omitió: ROADMAP.md lo confirma — el sprint de
// Archivos (Google Drive) está listado como trabajo futuro que ni siquiera
// empezó (depende de capturar `provider_refresh_token`, que todavía no se
// hace), y Notas no existe en ninguna forma. Prometerlo en el onboarding
// sería mentirle al usuario en su primer minuto de uso.
//
// Cada texto de abajo describe algo que YO VERIFIQUÉ que existe hoy en el
// código, no en el plan:
//   · Paso 2 → TaskManagementAgent (crear/modificar/borrar por texto),
//     AdjuntoBoton (foto/PDF), DictadoBoton (voz), Deshacer real.
//   · Paso 3 → app/horario (rejilla manual), importarFoto.ts (foto),
//     inferirFecha.ts enchufado en POST /api/tareas (fecha automática).
//   · Paso 4 → cron de recordatorios + ventanas.ts + gate.ts, y
//     detectarColisiones/esFechaPlausible de CalendarAgent.

export type PasoOnboarding = {
  id: string
  /** Etiqueta corta y monoespaciada arriba del título — el mismo recurso
   *  que ya usa /login para "Flow+" y /ai para sus secciones. */
  etiqueta: string
  titulo: string
  descripcion: string
  Ilustracion: ComponentType<{ className?: string }>
}

export const PASOS: PasoOnboarding[] = [
  {
    id: 'bienvenida',
    etiqueta: 'Flow+',
    titulo: 'Tu agenda, con IA de verdad',
    descripcion:
      'No es un chat que tienes que abrir para que sirva. Flow+ entiende lo que le cuentas, organiza tus entregas y te avisa a tiempo — tú solo escribes como le escribirías a un compañero.',
    Ilustracion: IlustracionBienvenida,
  },
  {
    id: 'conversacion',
    etiqueta: '01',
    titulo: 'Cuéntale tus tareas como a un compañero',
    descripcion:
      'Escribe "el jueves entrego el ensayo de Historia" y listo. También puedes mandarle una foto del tablero o un PDF, o dictarle en voz alta. Y si te equivocaste, díselo: modifica y borra tareas hablándole normal, y siempre puedes deshacer.',
    Ilustracion: IlustracionConversacion,
  },
  {
    id: 'horario',
    etiqueta: '02',
    titulo: 'Tu horario, siempre a mano',
    descripcion:
      'Arma tu semana a mano o mándale una foto del horario y lo llena solo. Después, cuando anotes una tarea sin fecha, Flow+ ya sabe cuándo toca esa materia y le pone la fecha de la próxima clase.',
    Ilustracion: IlustracionHorario,
  },
  {
    id: 'recordatorios',
    etiqueta: '03',
    titulo: 'Nunca se te olvida nada',
    descripcion:
      'Los recordatorios se adelantan más cuando la entrega es importante o es un examen, y se agrupan para no llenarte de avisos. Si pones dos cosas pesadas el mismo día, te lo dice antes de que te agarre por sorpresa.',
    Ilustracion: IlustracionRecordatorios,
  },
  {
    id: 'empezar',
    etiqueta: 'Listo',
    titulo: 'Empecemos',
    descripcion:
      'Lo más rápido para arrancar: carga tu horario y cuéntale tu primera tarea. Con eso Flow+ ya tiene con qué ayudarte de verdad.',
    Ilustracion: IlustracionEmpezar,
  },
]
