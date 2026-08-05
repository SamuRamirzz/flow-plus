# Parte 1-2 — Análisis del problema y filosofía de IA de Agenda+

> Documento 1 de 12 de la arquitectura de IA de Agenda+. Ver [README.md](./README.md) para el índice completo y las decisiones marco (plataforma, modelo económico, equipo) que condicionan todo el documento.

---

## Parte 1 — El problema real del estudiante

Antes de diseñar cualquier IA hay que ser honestos sobre qué problema resuelve. La mayoría de apps de productividad académica (MyStudyLife, Google Classroom, incluso Notion) resuelven el problema de **almacenar** información, no el de **actuar** sobre ella. El estudiante no tiene un problema de almacenamiento — tiene un problema de **carga cognitiva** y **fricción de captura**. Este documento parte de esa distinción.

### 1.1 Taxonomía de problemas

Agrupamos los problemas en cinco categorías, porque cada una exige un tipo de intervención de IA distinto (esto se retoma en la Parte 14 — proactividad):

**A. Problemas de captura (información que existe pero no entra al sistema)**
- Tareas anunciadas verbalmente en clase ("no olviden entregar el laboratorio el viernes") que nunca llegan a ningún calendario.
- Fotos de pizarras, diapositivas de última hora, guías en PDF con fechas enterradas en el texto.
- Horarios que cambian (cambio de aula, clase cancelada, examen reprogramado) comunicados por WhatsApp/correo y jamás reflejados en la agenda.
- Apuntes manuscritos desordenados que contienen fechas y compromisos mezclados con contenido académico.

Esto no es un problema de "falta de una app" — el estudiante ya tiene MyStudyLife, Google Calendar, Notion, y sigue olvidando cosas. El problema es que **cargar la información manualmente tiene una fricción mayor que el beneficio percibido en el momento de la captura**. Nadie abre una app y crea una tarea a las 11pm en medio de clase.

**B. Problemas de priorización y planificación**
- Múltiples materias, múltiples profesores, sin visión unificada de la carga real de la semana.
- Incapacidad de estimar cuánto tiempo toma realmente una tarea (sesgo de planificación — casi universal, no es pereza).
- Colisión de fechas: tres exámenes la misma semana, un ensayo y un proyecto grupal el mismo día.
- Falta de desglose: una tarea de "hacer el ensayo" no se traduce en pasos accionables con tiempos.

**C. Problemas de procrastinación y motivación**
- Procrastinación no es solo pereza: es evitación de tareas ambiguas, sensación de sobrecarga, o falta de un "primer paso" claro.
- Ausencia de feedback de progreso — el estudiante no ve avance hasta que termina, lo que reduce motivación intermedia.
- Fatiga de decisión: decidir "qué hacer ahora" es en sí mismo un costo cognitivo que compite con hacer el trabajo.

**D. Problemas de sobrecarga de información**
- PDFs de 80 páginas para un examen de dos temas.
- Apuntes de la materia dispersos en tres formatos (fotos, PDFs, notas propias) sin síntesis.
- Dificultad para distinguir qué es examinable de qué es contexto.

**E. Problemas de aprendizaje real (no solo organización)**
- Confundir "haber leído" con "haber aprendido" — releer no es estudiar.
- Ausencia de repetición espaciada — el estudiante repasa todo la noche anterior al examen.
- No saber en qué está débil hasta que ve la nota del examen (feedback demasiado tardío para actuar).

### 1.2 Por qué las soluciones actuales fallan

| Categoría | Por qué Google Calendar / Classroom / MyStudyLife no lo resuelven |
|---|---|
| Captura | Requieren entrada manual estructurada; cero comprensión de lenguaje natural o imágenes |
| Priorización | Muestran fechas, no calculan prioridad, dificultad, ni tiempo real necesario |
| Motivación | Cero proactividad — son pizarras pasivas que esperan ser consultadas |
| Sobrecarga | No resumen, no clasifican, no destilan; el PDF de 80 páginas sigue siendo 80 páginas |
| Aprendizaje | No son herramientas de estudio, son herramientas de calendario |

Notion AI y ChatGPT sí tienen comprensión de lenguaje e imagen, pero **exigen que el usuario inicie la interacción** (abrir el chat, formular la pregunta). Eso no resuelve el problema de captura — sigue habiendo fricción de "acordarme de preguntarle a la IA".

### 1.3 La conclusión de diseño

El problema central no es "falta de inteligencia artificial" — es que **ninguna herramienta actúa sin que el usuario decida activamente usarla**. La oportunidad de Agenda+ es cerrar esa brecha: que la inteligencia se dispare por eventos (una foto, una tarea creada, el paso del tiempo, un patrón detectado) en lugar de por un prompt del usuario. Esto define directamente la filosofía de la Parte 2 y la arquitectura de agentes de la Parte 5.

---

## Parte 2 — Filosofía de IA de Agenda+

### 2.1 La comparación que importa

| Producto | Modelo de interacción | Qué le falta para un estudiante |
|---|---|---|
| **ChatGPT / Gemini (chat)** | El usuario pregunta, la IA responde | No conoce el contexto académico del usuario salvo que se lo repitan cada vez; no es proactivo; no vive dentro del flujo de tareas |
| **Notion AI** | Comandos dentro del editor, bajo demanda | Mismo problema: reactivo, requiere que el usuario decida invocarlo; no tiene modelo de calendario/tiempo |
| **Google Classroom** | Ninguna IA real; solo estructura administrativa impuesta por el profesor | No hay comprensión, priorización ni adaptación al estudiante individual |
| **MyStudyLife** | Calendario académico manual | Cero IA; captura 100% manual |
| **Google Calendar** | Calendario genérico + Gemini superficial | No entiende materias, dificultad, ni carga cognitiva académica; Gemini es un asistente general, no un tutor |

Agenda+ no compite ofreciendo "un chat mejor". Compite ofreciendo **una capa de inteligencia que el estudiante no tiene que operar**. La métrica de éxito no es "cuántos mensajes envía el usuario a la IA" — es **cuántas veces la IA actuó correctamente sin que el usuario se lo pidiera**, y qué tan bajo es el porcentaje de intervenciones molestas o irrelevantes.

### 2.2 Analogía de referencia: Apple Intelligence, no ChatGPT

Apple Intelligence tiene un principio de diseño que Agenda+ adopta explícitamente: **la IA se integra en flujos existentes en lugar de crear un flujo nuevo**. Ejemplos del patrón que replicamos://
- Igual que Apple Intelligence resume una notificación sin que el usuario abra una app de "resúmenes", Agenda+ debe resumir un PDF de examen sin que el usuario abra un "chat de resúmenes" — el resumen aparece adjunto a la tarea/examen correspondiente.
- Igual que Siri sugiere una app en base a contexto (hora, ubicación, hábito) sin que el usuario pregunte, Agenda+ debe sugerir "ahora es buen momento para repasar Cálculo" sin que el usuario abra un chat de estudio.
- Igual que Apple Intelligence es notablemente silenciosa cuando no tiene algo útil que decir, Agenda+ debe tener **un umbral de confianza y utilidad explícito** antes de intervenir (se detalla en 2.4 y en la Parte 14).

La diferencia clave frente a Apple Intelligence: Agenda+ en la Fase 1 es Web/PWA, no un sistema operativo — no tenemos acceso a señales del dispositivo (uso de pantalla, ubicación, notificaciones del sistema) que Apple sí tiene. Esto es una limitación real que se documenta explícitamente en la Parte 10 y en el roadmap (Parte 21): en fases tempranas, la "proactividad" de Agenda+ se basa en **datos propios del dominio académico** (fechas, materias, patrones de completado) y no en señales de uso del dispositivo. Señales de contexto más ricas (ubicación, tiempo de pantalla) solo estarán disponibles si/cuando exista una app nativa.

### 2.3 Personalidad de la IA

La IA de Agenda+ debe sentirse como un **compañero de estudio organizado**, no como un profesor, no como un asistente corporativo, no como un chatbot genérico:

- **Directa, no ceremoniosa.** Nunca "¡Claro! Estaré encantado de ayudarte a organizar tu semana 😊". En su lugar: "Tienes 3 exámenes esta semana. Sugiero mover el repaso de Historia al lunes."
- **Nunca finge certeza que no tiene.** Si extrajo una fecha de una foto borrosa, lo dice ("Creo que dice 15 de marzo, pero la foto no es clara — confírmalo") en lugar de crear una tarea con una fecha inventada silenciosamente. Esto es un requisito de diseño, no un detalle de copy — se traduce en un campo de confianza en cada extracción (Parte 12).
- **Consciente de que es una herramienta de apoyo, no de reemplazo.** No resuelve la tarea del estudiante (no le hace el ensayo), lo ayuda a planearla, desglosarla y a estudiar el contenido (tutor socrático, Parte 16) — distinción importante tanto ética como de producto (un estudiante que "hace trampa" con la IA no vuelve a usar la app cuando el examen revela que no aprendió nada).
- **Económica en palabras.** Cada intervención proactiva debe poder leerse en menos de 3 segundos. Nada de párrafos.

### 2.4 Cuándo intervenir y cuándo callar

Esta es la decisión de diseño más importante del documento completo, porque una IA proactiva mal calibrada es peor que no tener IA (genera fatiga de notificación y el usuario la desactiva — ver Parte 22, riesgos de UX).

**Marco de decisión — la IA interviene solo si se cumplen las tres condiciones:**

1. **Confianza suficiente**: la inferencia (fecha, prioridad, riesgo) supera un umbral de confianza estadística explícito (Parte 17). Una predicción con 55% de confianza no genera una notificación; puede, como mucho, generar una sugerencia silenciosa dentro de la UI (ver más abajo la distinción "empujar vs. dejar disponible").
2. **Utilidad accionable**: el usuario puede hacer algo con la información *ahora* o en la ventana de tiempo en la que se le informa. "Tu examen es en 3 semanas" no es accionable hoy; "Tienes examen mañana y no has abierto los apuntes" sí lo es.
3. **No redundancia**: si el usuario ya vio esa información (abrió la tarea, la marcó, la reprogramó), la IA no la repite. Esto exige que el Orchestrator (Parte 4) mantenga estado de qué ya fue comunicado.

**Dos canales de intervención, no uno:**

- **Empujar (push/notificación):** reservado a los casos de las tres condiciones cumplidas y además con coste de omisión alto (examen mañana, tarea vencida hoy, conflicto de horario detectado). Frecuencia limitada — ver Parte 15.
- **Dejar disponible (superficie pasiva en la UI):** el grueso de la inteligencia de Agenda+ debe vivir aquí, no en notificaciones. Un panel de "esto es lo que noté" que el usuario revisa cuando abre la app, sin interrumpir. Esto es lo que separa a Agenda+ de una app que "spamea" — la mayoría de las sugerencias (reordenar la semana, unir dos sesiones de repaso, flashcards generadas de un PDF) se muestran, no se empujan.

**Regla dura de silencio:** si la IA no tiene nada con confianza + utilidad + no-redundancia, no genera contenido de relleno. Nunca "¡Vas muy bien, sigue así!" sin datos que lo respalden — eso es ruido, y erosiona la confianza en el resto de las intervenciones (si la IA dice cosas vacías, el usuario deja de leer también las importantes).

### 2.5 Qué NO es Agenda+ (límites explícitos de producto)

Reiterando y anclando lo que el usuario pidió explícitamente, como restricciones de diseño permanentes, no solo de esta fase:

- No es una caja de texto para "preguntarle cualquier cosa a la IA" como función central. Puede existir una entrada de texto/voz de bajo perfil para casos donde el usuario sí quiere preguntar algo puntual (ej. "¿cuándo es mi próximo examen de Química?"), pero no es la superficie principal de interacción ni el mecanismo primario de creación de tareas.
- No genera funciones porque "están de moda" (no hay generador de imágenes, no hay "personaje IA" con avatar, no hay gamificación superficial sin sustento pedagógico). Cada agente del catálogo (Parte 5) debe justificarse contra un problema de la Parte 1.
- No reemplaza el trabajo académico del estudiante — el diseño de Study Coach y Tutor (Parte 16) es deliberadamente socrático: guía, no entrega respuestas de examen.

### 2.6 Cómo se sostiene esta filosofía en el resto del documento

Cada parte posterior debe poder trazarse de vuelta a esta sección:
- El Orchestrator (Parte 4) implementa el marco de confianza/utilidad/no-redundancia como lógica de decisión explícita, no como prompt engineering suelto.
- El catálogo de agentes (Parte 5) está diseñado alrededor de las cinco categorías de problemas de la Parte 1 — no hay un agente sin un problema de origen.
- Las notificaciones inteligentes (Parte 15) implementan literalmente los dos canales (empujar vs. dejar disponible) descritos aquí.
- El roadmap (Parte 21) secuencia las fases empezando por resolver la categoría A (captura), porque es el problema con mayor fricción y menor solución existente — antes de invertir en predicción (categoría E, la más compleja y costosa).
