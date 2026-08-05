'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useDatosAgenda } from '@/lib/useDatosAgenda'
import { hoyISOLocal } from '@/lib/horario/hoy'
import { proximaClaseHoy, encabezadoVivo, proximasTareas } from '@/lib/estadisticas/pulso'
import { tendenciaSemanal, desglosePorMateria, calcularRacha, evaluarSuficiencia } from '@/lib/estadisticas/agregacion'
import PulsoDelDia from './PulsoDelDia'
import ProximasTareas from './ProximasTareas'
import AccesosRapidos from './AccesosRapidos'
import TarjetaSemana from './TarjetaSemana'
import TarjetasCompactas from './TarjetasCompactas'
import TarjetaTendencia from './TarjetaTendencia'
import TarjetaPorMateria from './TarjetaPorMateria'
import TarjetaPuntualidad from './TarjetaPuntualidad'

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const
const SEMANAS_TENDENCIA = 6

// Sprint Home — la sección Home real, separada de Agenda (ver el comentario
// de alcance en AgendaHome.tsx). Fusiona el pulso del día (Parte A) con lo
// que antes era el ítem "Estadísticas" del sidebar —nunca implementado,
// solo un `href="#"` — que pasaba a ser una sub-vista de informes (Parte B).
//
// Rediseño bento (referencia visual: composición asimétrica tipo Donzo —
// ver la nota en la entrada de ROADMAP.md): la sub-vista "Cómo vas" con su
// propio botón Volver DESAPARECE. Sus gráficas (tendencia/por-materia/
// puntualidad) ya no viven detrás de un clic: se incrustan como tarjetas
// propias, en la misma página, siguiendo debajo del pulso — exactamente el
// principio que pedía la referencia ("no separes la gráfica de su
// contexto"). Ninguna función de lib/estadisticas/ se reescribió: es la
// misma lógica pura de siempre, solo compuesta distinto en el JSX.
//
// Sin mutaciones: `useDatosAgenda()` en modo solo-lectura (nunca llama a
// `recargar()`) — esta pantalla nunca crea/edita/borra una tarea
// directamente, sus accesos rápidos NAVEGAN a /ai o /agenda para eso.
export default function InicioSection() {
  const { materias, tareas, horario, cargando } = useDatosAgenda()

  const hoyStr = useMemo(() => hoyISOLocal(), [])
  const horaActual = useMemo(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }, [])

  const proximaClase = useMemo(() => proximaClaseHoy(horario, materias, hoyStr, horaActual), [horario, materias, hoyStr, horaActual])
  const encabezado = useMemo(() => encabezadoVivo(tareas, proximaClase, hoyStr), [tareas, proximaClase, hoyStr])
  const tareasProximasPulso = useMemo(() => proximasTareas(tareas, materias, hoyStr), [tareas, materias, hoyStr])
  const estadoDatos = useMemo(() => evaluarSuficiencia(tareas), [tareas])
  const semanaActual = useMemo(() => tendenciaSemanal(tareas, hoyStr, 1)[0] ?? null, [tareas, hoyStr])
  const semanas = useMemo(() => tendenciaSemanal(tareas, hoyStr, SEMANAS_TENDENCIA), [tareas, hoyStr])
  const desglose = useMemo(() => desglosePorMateria(tareas, materias, hoyStr), [tareas, materias, hoyStr])
  const racha = useMemo(() => calcularRacha(tareas, hoyStr), [tareas, hoyStr])

  if (cargando) return null

  return (
    <main className="relative z-10 min-h-screen px-6 lg:pl-24 py-12 pb-28 max-w-6xl mx-auto">
      <PulsoDelDia encabezado={encabezado} />

      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: EASE_ASENTAR, delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        {/* Fila 1 — la métrica destacada + tres compactas al lado. En
            desktop la tarjeta grande ocupa la mitad izquierda; las tres
            compactas se agrupan en su propia fila de 3 en la mitad
            derecha (nunca se apilan entre sí, ni en móvil — tres números
            cortos caben lado a lado a cualquier ancho). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TarjetaSemana estado={estadoDatos} semanaActual={semanaActual} racha={racha} className="min-h-[220px]" />
          <TarjetasCompactas tareas={tareas} hoy={hoyStr} className="lg:h-full" />
        </div>

        {/* Fila 2 — contexto vivo del día (próxima clase + próximas
            tareas) a la izquierda, accesos rápidos de navegación pura a
            la derecha, en una columna compacta. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ProximasTareas tareas={tareasProximasPulso} hoy={hoyStr} proximaClase={proximaClase} className="lg:col-span-2 h-full" />
          <AccesosRapidos />
        </div>

        {/* Fila 3 — las gráficas de estadísticas, incrustadas en sus
            propias tarjetas (nunca detrás de un clic ni en una sub-vista
            aparte). Tendencia es la que más espacio necesita para leerse
            (tiene la gráfica de barras); por-materia y puntualidad son
            más angostas, lado a lado con ella. */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <TarjetaTendencia estado={estadoDatos} semanas={semanas} className="md:col-span-2" />
          <TarjetaPorMateria desglose={desglose} />
          <TarjetaPuntualidad tareas={tareas} />
        </div>
      </motion.div>
    </main>
  )
}
