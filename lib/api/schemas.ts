import { z } from 'zod'

// Esquemas de validación para los Route Handlers — compartidos entre el
// handler (que valida el body) y, donde aplica, el cliente (para dar
// feedback antes de enviar). zod solo vive en el borde HTTP: no reemplaza
// a OutputParser (lib/ai/types/parser.ts), que además de validar normaliza
// y nunca lanza — una propiedad de la que depende AIOrchestrator.
//
// OJO con z.uuid()/z.string().uuid(): en esta versión de zod valida
// específicamente el formato UUID v4 (nibble de versión = 4), no "cualquier
// cosa con forma de UUID". Usar z.guid() si alguna vez hace falta validar un
// UUID sin restricción de versión.
//
// (Este comentario advertía antes que la constante USUARIO_SIN_AUTH no pasaba
// esa validación. El Sprint Auth eliminó la constante: los ids de usuario ahora
// salen de `auth.uid()`, que Supabase genera como UUID v4 real, así que la
// advertencia dejó de aplicar.)

export const prioridadSchema = z.enum(['baja', 'media', 'alta'], {
  error: 'La prioridad debe ser baja, media o alta',
})

// Sprint 10: mismos 6 valores del CHECK de la columna `tareas.tipo` (Sprint
// 5) y de HomeworkTaskType (lib/ai/agents/homework/types.ts) — se repiten
// literal en vez de importar ese tipo para no acoplar el borde HTTP
// genérico a un agente concreto, igual criterio que prioridadSchema.
// Opcional en ambos schemas de abajo: hasta este sprint nada lo guardaba
// (ver POST /api/tareas), así que todas las tareas existentes quedan en
// 'otro' vía el DEFAULT de la base si no se manda.
export const tipoTareaSchema = z.enum(['ejercicios', 'examen', 'ensayo', 'lectura', 'proyecto', 'otro'], {
  error: 'El tipo debe ser ejercicios, examen, ensayo, lectura, proyecto u otro',
})

// Sprint 10: de dónde viene una `fecha` explícita — mismo vocabulario
// 'usuario'|'ia' que ya recibe inferirFechaEntrega() como origenExplicita.
// Nombrado fechaOrigen (no `origen`) para no confundirse con la columna
// tareas.origen ('manual'/'ia_texto'/'ia_foto', Sprint 5), que describe cómo
// se creó la FILA entera, no de dónde salió esta fecha en particular.
// Opcional, default 'usuario' en el handler: los llamadores que no lo
// mandan (AddTaskBar, toggle/editarTarea) siguen comportándose igual que
// antes de este campo existir.
export const fechaOrigenSchema = z.enum(['usuario', 'ia']).optional()

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .or(z.literal(''))

// Cierre de Fase 1 — campos que solo tiene un examen (ver la migración
// 20260802000000 para por qué son columnas de `tareas` y no una tabla
// aparte). Los tres son `.nullable().optional()`: opcional porque casi ningún
// llamador los manda (AddTaskBar no los pide), y nullable para poder
// BORRARLOS explícitamente cuando el usuario corrige un examen a tarea normal
// — `undefined` (ausente) significa "no lo toques", `null` significa
// "vacíalo", distinción que el handler respeta.
//
// El enum de formato y el rango 0-100 de peso replican exactamente los CHECK
// de la base: validar acá devuelve un 400 en español en vez de dejar que
// Postgres tire un error de constraint que el usuario no entendería.
export const formatoExamenSchema = z.enum(['oral', 'escrito', 'proyecto', 'mixto'], {
  error: 'El formato debe ser oral, escrito, proyecto o mixto',
})

const camposExamen = {
  temario: z.string().trim().min(1).nullable().optional(),
  formato: formatoExamenSchema.nullable().optional(),
  peso: z.number().min(0, 'El peso no puede ser negativo').max(100, 'El peso no puede pasar de 100').nullable().optional(),
}

export const crearMateriaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la materia no puede estar vacío'),
})

// Cierre de Fase 1 — acción real detrás del aviso de dedup semántico
// (CalendarAgent). `origenId` es la materia recién creada que el usuario
// decide NO mantener; `destinoId` es la existente con la que se queda. Los
// nombres son explícitos (no "materiaId"/"otraId") porque la dirección de
// la fusión importa: origen desaparece, destino sobrevive con su ícono/
// color intactos — ver POST /api/materias/fusionar.
export const fusionarMateriasSchema = z
  .object({
    origenId: z.string().uuid('origenId no es un id válido'),
    destinoId: z.string().uuid('destinoId no es un id válido'),
  })
  .refine((v) => v.origenId !== v.destinoId, { message: 'No se puede fusionar una materia consigo misma', path: ['destinoId'] })

export const crearTareaSchema = z
  .object({
    titulo: z.string().trim().min(1, 'El título de la tarea no puede estar vacío'),
    materiaId: z.string().uuid('materiaId no es un id válido').nullable(),
    nuevaMateria: z.string().trim().min(1).nullable(),
    fecha: fechaSchema,
    prioridad: prioridadSchema,
    tipo: tipoTareaSchema.optional(),
    fechaOrigen: fechaOrigenSchema,
    ...camposExamen,
    // Cierre de Fase 1 — conecta ExamAgent (construido en Sprint 12 pero
    // nunca disparado, hallazgo de la segunda auditoría de cierre de Fase
    // 1). El mensaje libre del que salió esta tarea, SOLO cuando el
    // llamador lo tiene (TaskManagementAgent en /ai) — AddTaskBar no tiene
    // texto libre que mandar y simplemente no manda este campo. El servidor
    // solo lo usa si `tipo==='examen'` y temario/formato/peso no vinieron
    // ya explícitos.
    textoOrigen: z.string().trim().optional(),
  })
  .refine((v) => v.materiaId || v.nuevaMateria, {
    message: 'La tarea necesita una materia',
    path: ['materiaId'],
  })

// Sprint 7.1 Parte 2: se extiende más allá de completada/titulo para que
// el agente de gestión de tareas (modificar por texto libre) pueda cambiar
// fecha/prioridad/materia igual que crearTareaSchema — materiaId/nuevaMateria
// siguen el mismo contrato que al crear (id existente o nombre a resolver/
// crear en el servidor vía resolverOCrearMateria), nunca los dos a la vez.
export const actualizarTareaSchema = z
  .object({
    completada: z.boolean().optional(),
    titulo: z.string().trim().min(1, 'El título no puede quedar vacío').optional(),
    materiaId: z.string().uuid('materiaId no es un id válido').nullable().optional(),
    nuevaMateria: z.string().trim().min(1).nullable().optional(),
    fecha: fechaSchema.optional(),
    prioridad: prioridadSchema.optional(),
    tipo: tipoTareaSchema.optional(),
    // No entra en el .refine() de abajo a propósito: por sí solo (sin
    // `fecha`) no es un cambio real, es solo metadata de CÓMO se está
    // cambiando la fecha cuando esta sí viene en el mismo body.
    fechaOrigen: fechaOrigenSchema,
    ...camposExamen,
  })
  .refine((v) => !(v.materiaId && v.nuevaMateria), {
    message: 'No puede venir materiaId y nuevaMateria a la vez',
    path: ['materiaId'],
  })
  // OJO al agregar un campo nuevo a este schema: también hay que sumarlo a
  // esta lista, o el campo se valida bien pero el PATCH se rechaza con "No
  // hay nada que actualizar" cuando es el ÚNICO que viene. Pasó exactamente
  // eso al añadir temario/formato/peso (detectado probando el PATCH real
  // contra la API, no por los tests: los tests de este schema mandaban
  // siempre algún campo viejo junto al nuevo, así que nunca lo tocaron).
  // `fechaOrigen` queda fuera a propósito — por sí solo no es un cambio.
  .refine(
    (v) =>
      v.completada !== undefined ||
      v.titulo !== undefined ||
      v.materiaId !== undefined ||
      v.nuevaMateria !== undefined ||
      v.fecha !== undefined ||
      v.prioridad !== undefined ||
      v.tipo !== undefined ||
      v.temario !== undefined ||
      v.formato !== undefined ||
      v.peso !== undefined,
    { message: 'No hay nada que actualizar' }
  )

const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM (24h)')
  .nullable()
  .optional()

export const crearBloqueHorarioSchema = z
  .object({
    materiaId: z.string().uuid('materiaId no es un id válido'),
    diaSemana: z.number().int('diaSemana debe ser un entero').min(1, 'diaSemana debe estar entre 1 y 7').max(7, 'diaSemana debe estar entre 1 y 7'),
    horaInicio: horaSchema,
    horaFin: horaSchema,
  })
  .refine((v) => !v.horaInicio || !v.horaFin || v.horaInicio < v.horaFin, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['horaFin'],
  })

// Sub-sprint 8.2 — se extiende más allá de activo/horaInicio/horaFin
// (usado hasta ahora solo por el diff de importación) para que la edición
// inline de un bloque pueda cambiar materia/aula/profesor. `aula`/`profesor`
// aceptan `null` explícito (para poder vaciarlos desde el modal, no solo
// dejarlos como estaban) además de `undefined` (no tocar el campo).
export const actualizarBloqueHorarioSchema = z
  .object({
    activo: z.boolean().optional(),
    materiaId: z.string().uuid('materiaId no es un id válido').optional(),
    horaInicio: horaSchema,
    horaFin: horaSchema,
    aula: z.string().trim().max(100, 'El aula es demasiado larga').nullable().optional(),
    profesor: z.string().trim().max(100, 'El nombre del profesor es demasiado largo').nullable().optional(),
  })
  .refine((v) => !v.horaInicio || !v.horaFin || v.horaInicio < v.horaFin, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['horaFin'],
  })
  .refine(
    (v) =>
      v.activo !== undefined ||
      v.materiaId !== undefined ||
      v.horaInicio !== undefined ||
      v.horaFin !== undefined ||
      v.aula !== undefined ||
      v.profesor !== undefined,
    { message: 'No hay nada que actualizar' }
  )

// Sprint 8 — la foto ya está en Storage; lo que viaja es su ruta. Se
// restringe a lo que el propio cliente genera (`<uuid>/<archivo>`, sin `..`
// ni rutas absolutas) para que este campo no se pueda usar como una
// primitiva de lectura arbitraria del bucket.
export const analizarHorarioSchema = z.object({
  ruta: z
    .string()
    .trim()
    .min(1, 'Falta la ruta de la imagen')
    .max(200, 'La ruta es demasiado larga')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(png|jpe?g|webp)$/, 'La ruta de la imagen no es válida')
    .refine((v) => !v.includes('..'), 'La ruta de la imagen no es válida'),
})

// Sprint Archivos / Tramo 2a — el archivo ya está en el bucket de staging
// (`archivos-staging`); lo que viaja es su ruta, mismo criterio que
// `analizarHorarioSchema.ruta` de arriba: charset restringido y sin `..`,
// para que este campo no sirva como una primitiva de lectura arbitraria del
// bucket. A diferencia de esa, acepta cualquier extensión de las permitidas
// por el bucket (no solo imagen) — la validación de tipo real ya la hace
// Postgres vía `allowed_mime_types` al insertar el objeto.
//
// El prefijo `<user_id>/` NO se valida acá (zod no conoce al usuario
// autenticado): lo verifica el propio Route Handler antes de tocar Storage.
//
// `tareaId`/`materiaId` son independientes (igual que las columnas de
// `archivos`, ver la migración): un archivo puede no tener ninguna, o tener
// una sin la otra.
export const crearArchivoSchema = z.object({
  ruta: z
    .string()
    .trim()
    .min(1, 'Falta la ruta del archivo en staging')
    .max(300, 'La ruta es demasiado larga')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/, 'La ruta del archivo no es válida')
    .refine((v) => !v.includes('..'), 'La ruta del archivo no es válida'),
  nombre: z.string().trim().min(1, 'El nombre del archivo no puede estar vacío').max(255, 'El nombre es demasiado largo'),
  tareaId: z.string().uuid('tareaId no es un id válido').nullable().optional(),
  materiaId: z.string().uuid('materiaId no es un id válido').nullable().optional(),
  categoria: z.string().trim().min(1).max(50).nullable().optional(),
})

// Sprint Archivos / Fase 4.1 — espejo en zod del check constraint
// `notas_ancla_chk` (num_nonnulls(tarea_id, bloque_horario_id) <= 1): a lo
// sumo UN ancla, nunca las dos a la vez. Una nota sin ninguna ("suelta") es
// un estado válido de producto, no un error — ver el comentario de la
// migración de Fase 1.
// Tercera ancla — `archivoId`, sumada cuando `notas` ganó la columna
// correspondiente (migración 20260810000000). Mismo criterio "como mucho
// una a la vez" que ya regía para tarea/bloque, ahora sobre las 3.
const anclaNotaValida = (v: { tareaId?: string | null; bloqueHorarioId?: string | null; archivoId?: string | null }) =>
  [v.tareaId, v.bloqueHorarioId, v.archivoId].filter((x) => x != null).length <= 1
const MENSAJE_ANCLA_NOTA = 'Una nota solo puede estar anclada a una tarea, un bloque de horario o un archivo a la vez, nunca a más de uno'

export const crearNotaSchema = z
  .object({
    titulo: z.string().trim().min(1, 'El título no puede quedar vacío').max(200, 'El título es demasiado largo').nullable().optional(),
    // Sin `.min(1)`: el comentario de la migración documenta que la UI futura
    // va a autoguardar la fila en cuanto se abra el editor, antes de que haya
    // nada escrito — la columna ya tiene `default ''`, este schema no debe
    // exigir más que la base.
    contenido: z.string().max(20000, 'La nota es demasiado larga').optional(),
    tareaId: z.string().uuid('tareaId no es un id válido').nullable().optional(),
    bloqueHorarioId: z.string().uuid('bloqueHorarioId no es un id válido').nullable().optional(),
    archivoId: z.string().uuid('archivoId no es un id válido').nullable().optional(),
  })
  .refine(anclaNotaValida, { message: MENSAJE_ANCLA_NOTA, path: ['tareaId'] })

export const actualizarNotaSchema = z
  .object({
    titulo: z.string().trim().min(1, 'El título no puede quedar vacío').max(200, 'El título es demasiado largo').nullable().optional(),
    contenido: z.string().max(20000, 'La nota es demasiado larga').optional(),
    tareaId: z.string().uuid('tareaId no es un id válido').nullable().optional(),
    bloqueHorarioId: z.string().uuid('bloqueHorarioId no es un id válido').nullable().optional(),
    archivoId: z.string().uuid('archivoId no es un id válido').nullable().optional(),
  })
  .refine(anclaNotaValida, { message: MENSAJE_ANCLA_NOTA, path: ['tareaId'] })
  .refine((v) => v.titulo !== undefined || v.contenido !== undefined || v.tareaId !== undefined || v.bloqueHorarioId !== undefined || v.archivoId !== undefined, {
    message: 'No hay nada que actualizar',
  })

// Sprint Archivos / Fase 7 — una pregunta sobre un archivo concreto. El
// archivo NO viaja en el body: se identifica por el `[id]` de la ruta y el
// servidor lo baja de Drive (así el cliente nunca manda contenido binario
// que ya está guardado, mismo criterio que el resto de los endpoints de
// Archivos).
export const preguntarSobreArchivoSchema = z.object({
  pregunta: z.string().trim().min(1, 'La pregunta no puede estar vacía').max(1000, 'La pregunta es demasiado larga'),
})

// Sprint Archivos / Fase 5.1 — el recorte a 50 turnos y el criterio de
// cuándo intentar el resumen viven en lib/ai/conversaciones/guardar.ts, no
// acá: este schema solo valida FORMA (mismo criterio que el resto del
// archivo — zod es el borde HTTP, no la lógica de negocio). `en` es
// opcional porque el cliente de hoy (components/ai/conversacion.ts) no
// trackea timestamp por turno — si falta, el servidor lo completa con la
// hora de guardado.
export const guardarConversacionSchema = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(['usuario', 'ia'], { error: 'rol debe ser "usuario" o "ia"' }),
        texto: z.string().trim().min(1, 'texto no puede estar vacío'),
        en: z.string().datetime({ message: 'en debe ser una fecha ISO válida' }).optional(),
      })
    )
    .min(1, 'La conversación no puede estar vacía'),
})

// Sprint Onboarding — lo único que el cliente puede cambiar hoy del perfil.
//
// Deliberadamente NO acepta `nombre`: el nombre se rellena en el servidor
// desde los claims verificados de la sesión (ver PATCH /api/perfil), no
// desde el body. Aceptarlo del cliente le dejaría a cualquiera escribir
// texto arbitrario en su perfil sin ninguna ganancia — no hay pantalla que
// lo pida todavía. Cuando exista Ajustes, se añade ahí con su validación.
// Sección Ajustes — ampliado de "solo onboardingCompletado" a todos los
// campos opcionales de perfil_academico, mismo patrón que
// actualizarTareaSchema (arriba): todos `.optional()`, con un `.refine()`
// final que rechaza un PATCH vacío.
//
// `onboardingCompletado` sigue siendo `.literal(true)` y no `.boolean()`:
// no existe ningún caso de producto para "desmarcar" el onboarding desde
// el cliente — si alguna vez hace falta (ej. un botón "volver a ver la
// bienvenida" en Ajustes), se amplía ahí a propósito; hoy, un `false` solo
// puede ser un error del llamador.
//
// `nombre` es una edición DELIBERADA del usuario (categoría Perfil de
// Ajustes) — no tiene relación con el autorelleno-desde-claims que ya hace
// PATCH /api/perfil cuando `perfil.nombre` está vacío (ver el handler): ese
// autorelleno sigue leyendo los claims, nunca el body: este campo es
// exclusivamente para cuando el USUARIO decide cambiar su nombre a mano.
//
// `formatoReloj` reusa el mismo par de valores que la columna/constraint
// de la migración (lib/hora.ts::FormatoReloj) — si alguno de los dos
// cambia, hay que tocar los dos a la vez, no hay una fuente única
// compartida por ser un `check` de Postgres en un lado y un `z.enum` acá.
//
// noMolestarDesde/noMolestarHasta reusan `horaSchema` (arriba,
// crearBloqueHorarioSchema) — mismo formato HH:MM 24h, y `null` explícito
// borra la restricción (mismo significado que ya tienen esas columnas).
//
// OJO al agregar un campo nuevo: también hay que sumarlo a la lista del
// `.refine()` de abajo, o un PATCH que solo mande ese campo se rechaza con
// "No hay nada que actualizar" (ya pasó una vez con temario/formato/peso
// en actualizarTareaSchema — mismo gotcha, mismo archivo).
export const actualizarPerfilSchema = z
  .object({
    onboardingCompletado: z.literal(true, { error: 'Solo se puede marcar el onboarding como completado' }).optional(),
    nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(100, 'El nombre es demasiado largo').optional(),
    // Pantalla "Completa tu perfil" (paso de /bienvenida) — mismo criterio
    // que `nombre`: edición deliberada del usuario, nunca autorellenada.
    apellido: z.string().trim().min(1, 'El apellido no puede quedar vacío').max(100, 'El apellido es demasiado largo').optional(),
    pais: z.string().trim().length(2, 'El país debe ser un código ISO de 2 letras').optional(),
    zonaHoraria: z.string().trim().min(1, 'La zona horaria no puede quedar vacía').optional(),
    formatoReloj: z.enum(['12h', '24h'], { error: 'El formato de reloj debe ser 12h o 24h' }).optional(),
    maxNotifPorDia: z.number().int('maxNotifPorDia debe ser un entero').min(0, 'maxNotifPorDia no puede ser negativo').optional(),
    noMolestarDesde: horaSchema,
    noMolestarHasta: horaSchema,
  })
  .refine(
    (v) =>
      v.onboardingCompletado !== undefined ||
      v.nombre !== undefined ||
      v.apellido !== undefined ||
      v.pais !== undefined ||
      v.zonaHoraria !== undefined ||
      v.formatoReloj !== undefined ||
      v.maxNotifPorDia !== undefined ||
      v.noMolestarDesde !== undefined ||
      v.noMolestarHasta !== undefined,
    { message: 'No hay nada que actualizar' }
  )

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>
export type AnalizarHorarioInput = z.infer<typeof analizarHorarioSchema>
export type CrearMateriaInput = z.infer<typeof crearMateriaSchema>
export type FusionarMateriasInput = z.infer<typeof fusionarMateriasSchema>
export type CrearTareaInput = z.infer<typeof crearTareaSchema>
export type ActualizarTareaInput = z.infer<typeof actualizarTareaSchema>
export type CrearArchivoInput = z.infer<typeof crearArchivoSchema>
export type CrearNotaInput = z.infer<typeof crearNotaSchema>
export type ActualizarNotaInput = z.infer<typeof actualizarNotaSchema>
export type GuardarConversacionInput = z.infer<typeof guardarConversacionSchema>
export type PreguntarSobreArchivoInput = z.infer<typeof preguntarSobreArchivoSchema>
export type CrearBloqueHorarioInput = z.infer<typeof crearBloqueHorarioSchema>
export type ActualizarBloqueHorarioInput = z.infer<typeof actualizarBloqueHorarioSchema>

// Sprint Soporte + Eliminación de cuenta — `eliminarDriveTambien` es
// obligatorio (no `.optional()`): es la elección explícita que el encargo
// exige mostrar en la UI antes del botón de confirmar final, nunca un
// default silencioso. Que falte en el body es un error de validación, no
// "se asume que no" ni "se asume que sí" — ambas opciones son destructivas o
// irreversibles a su manera, así que ninguna debe ser implícita.
export const solicitarEliminacionCuentaSchema = z.object({
  eliminarDriveTambien: z.boolean({ error: 'Tienes que elegir qué hacer con tus archivos de Drive' }),
})

export type SolicitarEliminacionCuentaInput = z.infer<typeof solicitarEliminacionCuentaSchema>
