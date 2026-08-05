# Parte 5 — Catálogo de agentes

> Documento 4 de 12. Ver [README.md](./README.md) para el índice completo. Cada agente sigue el contrato declarativo definido en la Parte 4.4 (id, eventos disparadores, dependencias, modelo, esquema de salida, nivel de autonomía, presupuesto de coste).

## 5.1 Principio de diseño del catálogo

Ningún agente existe "porque queda bien tenerlo" — cada uno se traza a una categoría de problema de la Parte 1. Se agrupan aquí por esa categoría para que la trazabilidad sea explícita. La columna **Modelo** usa el routing de la Parte 9 (Haiku 4.5 = barato/rápido, Sonnet 5 = trabajo principal, Opus 5 = razonamiento profundo); se justifica ahí en detalle, aquí solo se declara.

---

## 5.2 Categoría A — Captura (resuelve el problema #1 de la Parte 1)

### OCR Agent
- **Responsabilidad:** convertir una imagen (foto de pizarra, apunte manuscrito, captura de pantalla, horario, tabla) en texto y estructura aprovechable.
- **Entrada:** imagen (base64 o referencia de archivo subido).
- **Salida:** texto extraído + metadatos de estructura (¿es una tabla? ¿es una lista? ¿hay una fecha visualmente destacada?) + un campo de confianza global.
- **Disparadores:** subida de foto/imagen por el usuario.
- **Dependencias:** ninguna (es la entrada de la cadena de captura visual).
- **Modelo:** Sonnet 5 (vision nativo de alta resolución) — ver Parte 11 para el pipeline completo; no se usa un OCR dedicado separado en la Fase 1, se justifica ahí.
- **Nivel de autonomía:** no escribe nada por sí mismo; es un paso intermedio.

### Image Understanding Agent
- **Responsabilidad:** un paso más allá del OCR puro — entender el *contenido semántico* de una imagen que no es principalmente texto (un diagrama, una gráfica de un PDF de física, una tabla de horario con colores/columnas). Se diferencia del OCR Agent en que su salida es una interpretación, no una transcripción.
- **Entrada:** imagen + tipo de contexto esperado (ej. "esto probablemente es un horario de clases").
- **Salida:** estructura interpretada (ej. lista de bloques horario→materia→aula) con confianza.
- **Disparadores:** foto etiquetada como horario/diagrama por el usuario, o inferida por Class Schedule Agent.
- **Dependencias:** puede consumir la salida cruda del OCR Agent.
- **Modelo:** Sonnet 5.

### PDF Agent
- **Responsabilidad:** ingestión de documentos largos (guías de examen, sílabos, capítulos) — extracción de texto, detección de fechas/entregas mencionadas dentro del documento, y preparación del contenido para Summarizer/Flashcards/Quiz Generator.
- **Entrada:** archivo PDF.
- **Salida:** texto segmentado por sección + lista de fechas/compromisos detectados dentro del documento (candidatos para el Deadline Analyzer) + metadatos (número de páginas, materia probable).
- **Disparadores:** subida de PDF.
- **Dependencias:** ninguna.
- **Modelo:** Sonnet 5, vía Files API para evitar reenviar el documento completo en cada llamada posterior (Summarizer, Flashcards, Quiz Generator reutilizan la referencia al archivo).

### Voice Agent
- **Responsabilidad:** transcribir y estructurar una nota de voz del estudiante ("recuérdame entregar el ensayo el viernes") en una intención accionable. Nota de alcance: la transcripción de audio en sí no es una capacidad nativa de la Messages API de Claude — este agente orquesta un paso de transcripción (proveedor externo de speech-to-text, a definir en implementación) seguido de la misma comprensión semántica que el Homework Agent aplica a texto. Se documenta aquí como agente porque el problema que resuelve (captura sin fricción, categoría A) es idéntico; la implementación técnica exacta del primer paso queda fuera del alcance de este documento de arquitectura de IA (no es una decisión de modelo de lenguaje).
- **Entrada:** audio corto.
- **Salida:** misma estructura que el Homework Agent (ver abajo).
- **Disparadores:** grabación de nota de voz.
- **Dependencias:** ninguna; alimenta al Homework Agent.
- **Modelo:** Sonnet 5 para el paso de comprensión una vez transcrito.

---

## 5.3 Categoría A→B — Comprensión y estructuración (el puente entre captura y organización)

### Homework Agent
- **Responsabilidad:** el agente central de comprensión — toma texto (de OCR, PDF, voz, o entrada manual) y lo convierte en una tarea estructurada: materia, título, fecha, prioridad, tipo, tiempo estimado. Implementa literalmente el pipeline de la Parte 12.
- **Entrada:** texto libre + contexto del usuario (lista de materias existentes, para no crear duplicados).
- **Salida:** objeto estructurado validado contra JSON Schema vía `output_config.format` — nunca texto libre que haya que parsear a mano.
- **Disparadores:** salida de OCR Agent, PDF Agent, Voice Agent, o entrada manual de texto del usuario.
- **Dependencias:** puede depender de OCR/PDF/Voice Agent.
- **Modelo:** Sonnet 5.
- **Nivel de autonomía:** autónomo con reversión fácil si confianza alta; sugerido si confianza media/baja (Parte 4.2.5).

### Exam Agent
- **Responsabilidad:** especialización del Homework Agent para exámenes — además de fecha/materia, intenta capturar temario cubierto, formato (oral/escrito/proyecto), y peso relativo en la nota si se menciona. Se separa del Homework Agent porque un examen dispara comportamiento distinto aguas abajo (Study Coach, Predicciones de riesgo — Parte 17).
- **Entrada:** texto/imagen con indicios de examen.
- **Salida:** estructura de examen (fecha, materia, temario si está disponible, peso).
- **Disparadores:** clasificación del Homework Agent detecta tipo "examen", o entrada directa del usuario.
- **Dependencias:** Homework Agent (para la clasificación inicial) o directo desde OCR/PDF.
- **Modelo:** Sonnet 5.

### Calendar Agent
- **Responsabilidad:** tomar la salida estructurada de Homework/Exam Agent y resolverla contra el calendario real del usuario — crea la tarea/evento en la base de datos, detecta si colisiona con algo existente (delegando la resolución de conflicto al Conflict Resolver), y decide si la fecha extraída es plausible (ej. rechazar una fecha ya pasada como probable error de OCR).
- **Entrada:** estructura validada de Homework/Exam Agent + calendario actual del usuario.
- **Salida:** tarea/evento creado o propuesto, con referencia a la colisión si existe.
- **Disparadores:** salida de Homework Agent / Exam Agent.
- **Dependencias:** Homework Agent o Exam Agent.
- **Modelo:** Haiku 4.5 (la lógica de colisión es determinística/estructurada, no requiere razonamiento pesado; el modelo aquí ayuda sobre todo a redactar el título final y detectar duplicados semánticos, ej. "Lab de Química" vs "Laboratorio Química").

### Class Schedule Agent
- **Responsabilidad:** mantener el horario recurrente de clases del estudiante (a diferencia de tareas puntuales) — interpreta fotos/capturas de horario y las convierte en bloques recurrentes semana a semana, y detecta cambios (aula distinta, clase cancelada) cuando se le presenta información nueva que contradice el horario ya guardado.
- **Entrada:** imagen de horario (vía Image Understanding Agent) o corrección manual.
- **Salida:** estructura de horario recurrente + lista de cambios detectados frente a la versión anterior.
- **Disparadores:** subida de horario, o mensaje detectado como "cambio de horario" (ej. una foto de un aviso).
- **Dependencias:** Image Understanding Agent.
- **Modelo:** Sonnet 5.

### Deadline Analyzer
- **Responsabilidad:** barrer documentos largos (salida del PDF Agent) o el propio calendario en busca de fechas mencionadas pero no todavía capturadas como tarea — ej. una fecha de entrega mencionada en la página 40 de una guía que el usuario nunca convirtió en tarea.
- **Entrada:** texto segmentado del PDF Agent, o el conjunto de tareas/exámenes actuales.
- **Salida:** lista de fechas candidatas no capturadas, con contexto de la frase donde aparecen (para que el usuario juzgue relevancia antes de aceptarlas).
- **Disparadores:** finalización del PDF Agent sobre un documento largo; ejecución periódica (batch) sobre documentos ya ingeridos si se detecta que se acerca una fecha mencionada.
- **Dependencias:** PDF Agent.
- **Modelo:** Sonnet 5, vía Batch API cuando corre de forma periódica (no interactiva).

### Conflict Resolver
- **Responsabilidad:** cuando dos o más compromisos colisionan (mismo horario, o sobrecarga de la misma franja del día), proponer una resolución — no la aplica automáticamente salvo casos triviales (ver nivel de autonomía).
- **Entrada:** conjunto de tareas/eventos en conflicto + preferencias del usuario (horas de estudio disponibles, Parte 7).
- **Salida:** propuesta de reordenamiento o de resolución de colisión, con justificación breve.
- **Disparadores:** Calendar Agent detecta colisión; Planning Agent detecta sobrecarga de un día.
- **Dependencias:** Calendar Agent, Planning Agent.
- **Modelo:** Sonnet 5.
- **Nivel de autonomía:** sugerido, requiere confirmación (mover el trabajo académico de un estudiante sin permiso explícito es una línea roja de confianza — Parte 2).

---

## 5.4 Categoría B — Planificación

### Planning Agent
- **Responsabilidad:** el agente de más alto nivel de la categoría de planificación — recalcula, ante cambios relevantes (nueva tarea, tarea completada, se acerca una fecha), cómo debería distribuirse el trabajo de la semana según prioridad, urgencia, dificultad estimada y tiempo disponible del usuario. Implementa el pipeline de la Parte 13.
- **Entrada:** todas las tareas/exámenes pendientes + Time Estimation Agent + preferencias/hábitos del usuario (memoria, Parte 8).
- **Salida:** plan de semana propuesto (qué día conviene trabajar en qué, sin fijar horas exactas salvo que el usuario lo pida).
- **Disparadores:** cron nocturno/semanal; cambios grandes (nueva tarea de alta prioridad, tarea vencida).
- **Dependencias:** Time Estimation Agent, Deadline Analyzer.
- **Modelo:** Sonnet 5, vía Batch API para la ejecución periódica; Sonnet 5 síncrono si el usuario pide "replanifica ahora" de forma interactiva.
- **Nivel de autonomía:** sugerido (ver Parte 2.4 — reordenar la semana de alguien es una intervención fuerte, se muestra en la superficie pasiva, no se empuja como notificación salvo sobrecarga crítica).

### Time Estimation Agent
- **Responsabilidad:** estimar cuánto tiempo tomará realmente una tarea, corrigiendo el sesgo de planificación del estudiante (Parte 1.1-B) — usa el tipo de tarea, la materia, y el historial de tiempos reales que el propio usuario ha registrado (si existe) como referencia bayesiana simple.
- **Entrada:** tarea estructurada + historial de tareas similares completadas por el usuario.
- **Salida:** estimación de tiempo con rango de confianza (no un número puntual falso-preciso).
- **Disparadores:** creación de una tarea nueva; recálculo periódico si el historial cambia sustancialmente.
- **Dependencias:** Homework/Exam Agent (para tener la tarea estructurada).
- **Modelo:** Haiku 4.5 para el caso simple (mapeo tipo de tarea → rango típico); escalable a Sonnet 5 si se introduce un modelo estadístico más fino (Parte 17).

---

## 5.5 Categoría C — Motivación y proactividad

### Motivation Agent
- **Responsabilidad:** detectar patrones de procrastinación o desánimo (tareas pospuestas repetidamente, racha de inactividad) y generar, cuando corresponde, una intervención breve y accionable — nunca una frase motivacional vacía (prohibido explícitamente en la Parte 2.4).
- **Entrada:** historial reciente de actividad (tareas pospuestas, sesiones de estudio no iniciadas) + memoria de hábitos (Parte 8).
- **Salida:** o bien nada (silencio, caso por defecto), o bien una sugerencia concreta ("Llevas 3 días posponiendo el ensayo de Historia — ¿empezamos con el primer párrafo ahora, 10 minutos?").
- **Disparadores:** cron diario; patrón de 2+ postergaciones consecutivas de la misma tarea.
- **Dependencias:** ninguna directa, lee del almacén de eventos.
- **Modelo:** Haiku 4.5 para la detección de patrón (regla + LLM ligero); Sonnet 5 solo para redactar la intervención cuando el patrón se confirma.

### Recommendation Agent
- **Responsabilidad:** agente transversal de "esto podría interesarte hacer ahora" — combina señales de Planning Agent, Time Estimation Agent y hábitos para sugerir la siguiente acción concreta cuando el usuario abre la app sin un objetivo claro (sustituye a una pantalla de inicio vacía).
- **Entrada:** estado completo del día/semana + memoria contextual.
- **Salida:** 1-3 sugerencias ordenadas, siempre accionables (nunca una lista genérica de "todo lo pendiente" — eso ya lo muestra la UI sin IA).
- **Disparadores:** apertura de la app (con caché de sesión para no recalcular en cada render).
- **Dependencias:** Planning Agent, Time Estimation Agent.
- **Modelo:** Haiku 4.5 (es un re-ranking/síntesis de información ya calculada por otros agentes, no un razonamiento nuevo pesado).

---

## 5.6 Categoría D — Síntesis y reducción de sobrecarga de información

### Summarizer Agent
- **Responsabilidad:** condensar un documento largo (PDF Agent) o un conjunto de apuntes en un resumen jerárquico (temas → subtemas → puntos clave), distinguiendo contenido examinable de contexto — ver Parte 12 para el criterio de esa distinción.
- **Entrada:** texto segmentado del PDF Agent o de apuntes fotografiados.
- **Salida:** resumen estructurado con niveles, y marcaje de qué secciones son "alta probabilidad de examen" si el documento es una guía.
- **Disparadores:** finalización del PDF Agent sobre un documento marcado como material de estudio.
- **Dependencias:** PDF Agent.
- **Modelo:** Sonnet 5.

### Flashcards Agent
- **Responsabilidad:** generar tarjetas de repaso (pregunta/respuesta) a partir de un resumen o documento, diseñadas para repetición espaciada (Parte 16) — no un volcado de definiciones, sino preguntas que fuerzan recuperación activa.
- **Entrada:** salida del Summarizer Agent o del PDF Agent directamente.
- **Salida:** lista de tarjetas con nivel de dificultad estimado.
- **Disparadores:** petición explícita del usuario, o sugerencia proactiva tras generar un Summarizer de una guía de examen.
- **Dependencias:** Summarizer Agent (recomendado) o PDF Agent.
- **Modelo:** Sonnet 5.

### Quiz Generator
- **Responsabilidad:** generar cuestionarios de práctica (opción múltiple, respuesta corta) alineados al temario detectado por Exam Agent, con nivel de dificultad progresivo.
- **Entrada:** temario del Exam Agent + contenido del Summarizer/PDF Agent.
- **Salida:** cuestionario estructurado + clave de respuestas + explicación breve por pregunta (para que sirva como aprendizaje, no solo evaluación — conecta con Study Coach).
- **Disparadores:** petición del usuario; sugerencia proactiva cuando se acerca la fecha de un examen con temario conocido.
- **Dependencias:** Exam Agent, Summarizer/PDF Agent.
- **Modelo:** Sonnet 5.

### Search Agent
- **Responsabilidad:** búsqueda dentro del propio contenido del usuario (sus tareas, apuntes, resúmenes ya generados) — explícitamente **no** es un buscador web de propósito general ni sustituye a ChatGPT; resuelve preguntas del tipo "¿cuándo es mi próximo examen de Química?" o "¿qué dije que tenía que hacer para el lunes?" contra los propios datos del usuario.
- **Entrada:** consulta en lenguaje natural + índice del contexto del usuario (Parte 7).
- **Salida:** respuesta puntual con referencia a la tarea/documento de origen.
- **Disparadores:** entrada de texto/voz del usuario en la superficie de consulta de bajo perfil (Parte 2.5 — existe, pero no es la interacción principal).
- **Dependencias:** ninguna estructural; lee del almacén de contexto.
- **Modelo:** Haiku 4.5 para consultas simples; escala a Sonnet 5 si la consulta requiere combinar varias fuentes.

---

## 5.7 Categoría E — Aprendizaje real

### Study Coach
- **Responsabilidad:** el agente tutor de más alto nivel — orquesta sesiones de estudio guiadas (qué repasar hoy, en qué orden, combinando Flashcards/Quiz Generator con la Parte 16) de forma socrática: hace preguntas antes de dar respuestas, nunca resuelve la tarea de examen por el estudiante.
- **Entrada:** materia/tema a estudiar + historial de desempeño en Quiz/Flashcards + tiempo disponible.
- **Salida:** secuencia de interacción (pregunta → espera respuesta → retroalimentación → siguiente paso), no un bloque de texto único.
- **Disparadores:** petición explícita del usuario ("quiero repasar Cálculo"); sugerencia proactiva del Recommendation Agent.
- **Dependencias:** Flashcards Agent, Quiz Generator, Predicciones (Parte 17, para saber en qué está débil el usuario).
- **Modelo:** Opus 5 (única función del catálogo que justifica el modelo más caro por defecto — requiere razonamiento pedagógico adaptativo turno a turno, no extracción estructurada; se limita con cuota estricta en el tier gratis, Parte 18).

---

## 5.8 Agentes de infraestructura (transversales, no ligados a una sola categoría de problema)

### Reminder Agent
- **Responsabilidad:** decidir la ventana óptima de recordatorio para una tarea/examen dado (a diferencia del Notification Agent, que decide *si* y *cómo* enviar — el Reminder Agent decide *cuándo* debería existir un recordatorio en primer lugar, en función de prioridad, tipo de tarea y tiempo estimado). Sustituye/evoluciona la heurística fija que hoy existe en `NotificationBell.tsx` (ventana fija por prioridad) por un cálculo contextual.
- **Entrada:** tarea/examen estructurado + Time Estimation Agent + hábitos del usuario.
- **Salida:** una o más ventanas de recordatorio propuestas (ej. "7 días antes: mencionar; 2 días antes: recordar con más énfasis; día de: recordatorio final").
- **Disparadores:** creación/edición de una tarea con fecha.
- **Dependencias:** Time Estimation Agent.
- **Modelo:** Haiku 4.5.
- **Nivel de autonomía:** autónomo (es infraestructura, no contenido que el usuario deba aprobar).

### Notification Agent
- **Responsabilidad:** el punto único de salida de todas las notificaciones — aplica el marco de las tres condiciones (confianza + utilidad + no-redundancia, Parte 2.4) y el motor de "momento ideal" (Parte 15) antes de enviar cualquier push. Todos los demás agentes que "quieren" notificar algo pasan por este agente, nunca notifican directo.
- **Entrada:** propuesta de notificación de cualquier otro agente (Reminder, Motivation, Conflict Resolver, Deadline Analyzer) + registro de qué ya se comunicó (para no-redundancia) + preferencias de frecuencia del usuario.
- **Salida:** decisión de enviar/no enviar + canal (push/email) + contenido final redactado de forma breve.
- **Disparadores:** cualquier agente que genere una propuesta de comunicación al usuario.
- **Dependencias:** todos los agentes que generan contenido comunicable.
- **Modelo:** Haiku 4.5 para la decisión y redacción (es short-form, alto volumen, bajo margen de error costoso).

---

## 5.9 Tabla resumen

| Agente | Categoría | Modelo por defecto | Autonomía |
|---|---|---|---|
| OCR Agent | Captura | Sonnet 5 | N/A (intermedio) |
| Image Understanding Agent | Captura | Sonnet 5 | N/A (intermedio) |
| PDF Agent | Captura | Sonnet 5 | N/A (intermedio) |
| Voice Agent | Captura | Sonnet 5 | N/A (intermedio) |
| Homework Agent | Captura→Comprensión | Sonnet 5 | Autónomo con reversión / sugerido |
| Exam Agent | Captura→Comprensión | Sonnet 5 | Autónomo con reversión / sugerido |
| Calendar Agent | Comprensión | Haiku 4.5 | Autónomo con reversión |
| Class Schedule Agent | Comprensión | Sonnet 5 | Sugerido |
| Deadline Analyzer | Comprensión | Sonnet 5 (batch) | Sugerido |
| Conflict Resolver | Planificación | Sonnet 5 | Sugerido |
| Planning Agent | Planificación | Sonnet 5 (batch) | Sugerido |
| Time Estimation Agent | Planificación | Haiku 4.5 | Autónomo |
| Motivation Agent | Motivación | Haiku 4.5 / Sonnet 5 | Sugerido (notif. vía Notification Agent) |
| Recommendation Agent | Motivación | Haiku 4.5 | Sugerido (superficie pasiva) |
| Summarizer Agent | Síntesis | Sonnet 5 | Autónomo con reversión |
| Flashcards Agent | Síntesis | Sonnet 5 | Autónomo con reversión |
| Quiz Generator | Síntesis | Sonnet 5 | Autónomo con reversión |
| Search Agent | Síntesis | Haiku 4.5 / Sonnet 5 | N/A (respuesta directa) |
| Study Coach | Aprendizaje | Opus 5 | Interactivo (no aplica autonomía de escritura) |
| Reminder Agent | Infraestructura | Haiku 4.5 | Autónomo |
| Notification Agent | Infraestructura | Haiku 4.5 | Autónomo (gate final) |

Este catálogo no es cerrado — el roadmap (Parte 21) especifica qué subconjunto se construye en cada fase, empezando por la cadena de captura (OCR/Homework/Calendar/Reminder) porque ataca directamente el problema #1 de la Parte 1.
