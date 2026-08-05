export type Materia = {
  id: string
  nombre: string
  color: string
  // Sub-sprint — ícono automático (lib/materias/asignarIcono.ts). Nombre
  // del ícono de lucide-react como string (ej. "Calculator"), nunca el
  // componente en sí — la base no sabe de React.
  icono: string
}

export type Tarea = {
  id: string
  titulo: string
  materia_id: string
  fecha_entrega: string | null
  prioridad: string
  completada: boolean
  // Existe en la base desde el Sprint 5 (default 'otro', CHECK con los
  // mismos 6 valores de HomeworkTaskType) pero faltaba en este tipo
  // compartido — string libre igual que `prioridad`, la UI es quien conoce
  // los valores reales válidos.
  tipo: string
  // Cierre de Fase 1 — solo con tipo='examen'. Son columnas de `tareas` y no
  // una tabla `examenes` aparte a propósito: así colisiones (Sprint 10),
  // recordatorios (Sprint 11), Deshacer (7.2) y las 6 rutas de lectura siguen
  // funcionando sin unir dos fuentes. Ver la migración 20260802000000 para el
  // razonamiento completo.
  temario: string | null
  formato: string | null
  /** Porcentaje de la nota final, 0-100. */
  peso: number | null
  // Sprint Home — cuándo se marcó `completada = true` por última vez (ISO,
  // con hora). `null` en una tarea nunca completada, o completada antes de
  // que esta columna existiera — ver la migración 20260806000000 para por
  // qué eso es "sin dato" y no "hace mucho tiempo". Se limpia a null si la
  // tarea vuelve a quedar pendiente.
  completada_en: string | null
}
