# Parte 9-10 — Arquitectura híbrida de modelos y local vs. cloud

> Documento 7 de 12. Ver [README.md](./README.md) para el índice completo.
>
> **Nota de vigencia de precios:** las cifras de Claude citadas aquí (IDs de modelo, precios por millón de tokens, ventanas de contexto) fueron verificadas contra la documentación vigente de la API de Anthropic al momento de escribir este documento (referencia interna: catálogo de modelos, julio 2026) y deben confirmarse contra `platform.claude.com` antes de fijar contratos o presupuestos definitivos, porque los proveedores actualizan precios y catálogos con frecuencia. Las referencias a precios de otros proveedores (OpenAI, Google, Mistral) se presentan de forma cualitativa/posicional, no como cifras exactas, precisamente por esa misma razón — no se tomó una fuente verificada de sus tarifas para este documento.

## Parte 9 — Por qué una arquitectura híbrida, y cómo se implementa sin multiplicar la complejidad operativa

### 9.1 El principio: "híbrido" significa poder cambiar de proveedor, no usar varios a la vez por defecto

El usuario pidió explícitamente no depender de un solo modelo. Para un equipo de una sola persona (restricción confirmada), la forma correcta de cumplir ese principio **no** es enrutar cada llamada a través de tres proveedores distintos comparando resultados (eso multiplica costo, latencia y superficie de fallos por 3 sin beneficio proporcional). La forma correcta es:

1. Elegir **un proveedor principal** para el grueso de los agentes, con justificación técnica explícita (9.2).
2. Construir el Orchestrator con una **capa de abstracción de proveedor** (ya prevista en el contrato de agente de la Parte 4.4: `modeloPorDefecto` / `modeloAlternativo`) de forma que cambiar de proveedor para un agente sea un cambio de configuración, no una reescritura.
3. Reservar el **segundo proveedor** para casos concretos donde aporta algo que el principal no cubre igual de bien, o como **plan de contingencia** ante una caída de servicio del principal — no como duplicación rutinaria.

Esto es "híbrido" en el sentido real que importa para el negocio: resiliencia y optionalidad, sin el costo operativo de mantener múltiples integraciones activas en producción desde el día uno.

### 9.2 Por qué Claude (Anthropic) como proveedor principal

Con los tres roles del equipo virtual del documento (arquitecto de OpenAI, arquitecto de Gemini, ingeniero de Copilot) puestos a evaluar de forma objetiva, la comparación relevante para el caso de uso de Agenda+ —extracción estructurada confiable, tool use, visión de documentos/pizarras, razonamiento de planificación, coste predecible para un solo desarrollador— es:

| Criterio | Por qué pesa para Agenda+ | Posición de Claude |
|---|---|---|
| **Salidas estructuradas confiables** | Casi todos los agentes (Homework, Exam, Calendar, Reminder) dependen de JSON válido y bien tipado para escribir directo en la base de datos sin parsing frágil | La API de Mensajes de Anthropic soporta `output_config.format` con JSON Schema validado por el propio servidor (structured outputs) y `strict: true` en herramientas — la salida llega ya validada, reduciendo la necesidad de lógica de reintento/reparación de JSON en el Orchestrator |
| **Tool use / agentic** | El Orchestrator delega en los agentes decisiones que a veces requieren varias vueltas de razonamiento con herramientas (ej. Conflict Resolver consultando el calendario antes de proponer) | Anthropic ha priorizado explícitamente el rendimiento agentic/tool-use en su línea de modelos recientes; el ecosistema de SDKs oficiales incluye un "tool runner" que automatiza el ciclo llamar→ejecutar→responder sin loop manual |
| **Visión de documentos** | OCR Agent, Image Understanding Agent y PDF Agent dependen de comprensión de imagen de alta fidelidad (pizarras borrosas, manuscritos, tablas de horario) | Los modelos Claude de la generación actual soportan imágenes de alta resolución (hasta ~2576px de lado largo) con mapeo 1:1 a píxeles, relevante para leer letra pequeña en una foto de pizarra |
| **Prompt caching y Batch API** | El modelo de costos de Agenda+ (freemium, Parte 18) depende de exprimir cada llamada | Anthropic ofrece cacheo de prefijo de prompt (hasta ~90% de descuento en la porción cacheada) y una API de lotes con 50% de descuento — ambos se usan explícitamente en el diseño de costos |
| **Previsibilidad de un solo proveedor para un equipo de 1 persona** | Menos superficie de integración, un solo panel de facturación, un solo conjunto de límites de tasa que monitorear | Reduce carga operativa real frente a mantener 2-3 SDKs, 2-3 esquemas de facturación y 2-3 comportamientos de "refusal"/errores distintos en producción desde el día uno |

**Conclusión de diseño:** Claude es el proveedor principal para el 100% de los agentes del catálogo (Parte 5) en la Fase 1. Esta no es una limitación — es la decisión correcta de complejidad-para-el-equipo. La sección 9.4 documenta el plan de resiliencia (qué pasa si Anthropic tiene una caída) y el criterio para introducir un segundo proveedor real en fases posteriores.

### 9.3 Routing interno de modelos Claude (esto sí es "híbrido" desde el día uno)

Dentro del propio catálogo de Anthropic existen tres niveles de capacidad/costo, y el routing entre ellos **sí** es una decisión que se toma por cada llamada, no una elección fija:

| Modelo | Precio (por millón de tokens, entrada/salida) | Contexto | Uso en Agenda+ |
|---|---|---|---|
| **Claude Haiku 4.5** | $1 / $5 | 200K tokens | Clasificación simple, redacción corta de notificaciones, decisiones de bajo riesgo (Reminder Agent, Notification Agent, Time Estimation Agent, Calendar Agent, Recommendation Agent, Search Agent simple) |
| **Claude Sonnet 5** | $3 / $15 (precio introductorio $2 / $10 hasta el 31-08-2026) | 1M tokens | El caballo de batalla: comprensión semántica (Homework/Exam Agent), visión (OCR/Image Understanding/PDF Agent), planificación (Planning Agent, Conflict Resolver), síntesis (Summarizer, Flashcards, Quiz Generator) |
| **Claude Opus 5** | $5 / $25 | 1M tokens | Reservado casi exclusivamente al Study Coach — la única función que exige razonamiento pedagógico adaptativo turno a turno de la más alta calidad, y que en el modelo freemium se limita por cuota al tier gratuito |

Esta tabla es la aplicación directa del criterio "un buen arquitecto no usa el modelo más caro por defecto" — cada fila de la Parte 5 (catálogo de agentes) ya declara su modelo por defecto siguiendo esta tabla; aquí se documenta el razonamiento consolidado.

**Reglas de asignación:**
1. Si la tarea es clasificación, extracción de un campo simple, o redacción de una frase corta → Haiku 4.5.
2. Si la tarea requiere comprensión semántica de texto/imagen no trivial, generación de contenido de estudio, o razonamiento de planificación con varias variables → Sonnet 5.
3. Si la tarea requiere sostener una interacción pedagógica adaptativa de varios turnos con juicio didáctico fino → Opus 5, y solo ahí.
4. Ningún agente usa Opus 5 "por si acaso" — el costo (5x el de Haiku en entrada, 5x en salida) solo se justifica donde el catálogo lo declara explícitamente.

### 9.4 Otros proveedores: qué rol juegan realmente

| Proveedor / familia | Rol en la arquitectura de Agenda+ | Por qué no es el proveedor principal |
|---|---|---|
| **OpenAI (GPT)** | Candidato a **proveedor de contingencia** para los agentes críticos de la cadena de captura (Homework/Calendar) — si Anthropic sufre una interrupción prolongada de servicio, el Orchestrator puede enrutar temporalmente a un modelo GPT usando el mismo contrato de esquema de salida (JSON Schema es un estándar portable entre proveedores) | Introducir un segundo proveedor activo en producción desde el día uno duplica el trabajo de mantenimiento (dos SDKs, dos comportamientos de error, dos facturaciones) que un equipo de una persona no debería absorber sin necesidad probada |
| **Google Gemini** | Candidato natural si en una fase futura se prioriza comprensión nativa de **audio/video** en tiempo real (el Voice Agent, Parte 5.2, hoy delega la transcripción a un paso externo porque Claude no procesa audio de forma nativa) — Gemini sí tiene soporte multimodal nativo de audio, lo que podría simplificar ese agente específico en el futuro | No aporta ventaja diferencial sobre Claude en el resto del catálogo (extracción estructurada, planificación, tutor), que es donde vive el 90% del valor de producto |
| **Mistral** | Sin rol en la Fase 1. Relevante como opción de modelos abiertos más adelante si se evaluara self-hosting a gran escala (Parte 20) | Requiere infraestructura propia de inferencia — descartado explícitamente por la restricción de equipo de una persona |
| **Llama (Meta)** | Igual que Mistral — candidato solo en un escenario de self-hosting a escala muy alta donde el costo marginal de inferencia propia supere claramente el costo de la API gestionada | Mismo motivo: coste operativo de MLOps incompatible con el equipo actual |
| **Qwen / DeepSeek** | Relevantes como opción de bajo costo si en el futuro (escala de cientos de miles de usuarios, Parte 18) se evalúa mover tareas de clasificación trivial a un modelo abierto autoalojado o servido por un proveedor de inferencia de terceros más barato | En la Fase 1, el ahorro no compensa la complejidad añadida; Haiku 4.5 ya es la opción de bajo costo dentro del proveedor principal |
| **Phi (Microsoft) / Gemma (Google)** | Modelos pequeños diseñados para **ejecución local/on-device** — relevantes únicamente en el escenario de app nativa con IA on-device (fase 4-5 del roadmap, Parte 21), no en la Fase 1 Web/PWA | Un modelo de esta clase corriendo en el navegador vía WebGPU/WASM es una optimización de fases posteriores, no una necesidad actual — se retoma en 10.4 |
| **Modelos de OCR dedicados** (motores tradicionales tipo Tesseract, o servicios de OCR gestionados) | Opción de reducción de costo si el volumen de fotos/documentos crece lo suficiente como para que el costo de usar visión de un LLM en cada imagen sea significativo frente a un OCR tradicional barato + LLM solo para la comprensión semántica del texto ya extraído | En la Fase 1, el volumen no lo justifica y la calidad de comprensión conjunta (leer + entender en una sola llamada) de un LLM de visión es superior para manuscritos y pizarras — se documenta la opción de desacoplar como palanca de costo futura (Parte 18), no como decisión actual |

### 9.5 Cuándo se activa realmente un segundo proveedor

Criterio explícito y verificable (evita que "diversificar proveedores" quede como intención vaga sin gatillo real):

- **Resiliencia:** si el proveedor principal sufre una interrupción de servicio que supere un umbral de tiempo definido operativamente (ej. degradación sostenida durante la ventana de uso pico de la app), el Orchestrator debe poder conmutar los agentes de la cadena de captura (Homework/Calendar) a un proveedor de respaldo configurado, usando el mismo esquema de salida.
- **Capacidad diferencial real:** si el Voice Agent pasa de ser una función menor a una función central del producto, se evalúa migrar su paso de comprensión a un proveedor con soporte de audio nativo.
- **Economía de escala:** si el análisis de costos (Parte 18) muestra que a un volumen de usuarios determinado el costo marginal de un proveedor alternativo (incluida la complejidad operativa de integrarlo) es claramente menor, se reevalúa — no antes.

---

## Parte 10 — Local vs. cloud vs. híbrido

### 10.1 Marco de decisión

Para cada tipo de procesamiento se evalúan cuatro ejes: **latencia** (¿el usuario espera la respuesta activamente?), **costo** (¿el volumen hace viable procesar localmente?), **privacidad** (¿el dato es sensible y se beneficia de no salir del dispositivo?), **escalabilidad** (¿el enfoque sigue siendo viable a 10x, 100x usuarios?).

### 10.2 Qué debe ser 100% local (Fase 1, Web/PWA)

Coherente con la decisión de plataforma confirmada (Web/PWA primero, sin señales nativas de dispositivo), lo que hoy corre localmente es **lógica determinística, no modelos de IA**:

- Cálculo de ventanas de recordatorio ya decididas por el Reminder Agent (una vez el servidor calculó la ventana, el disparo de la notificación en el navegador/service worker es lógica simple, sin LLM).
- Ordenamiento y filtrado de la vista de tareas/calendario (ya existe en `app/page.tsx` hoy, sin cambios).
- Validaciones de formulario y estados de UI.

No hay LLM on-device en la Fase 1. Esto es una limitación real frente a Apple Intelligence (que sí corre modelos pequeños en el dispositivo) — se documenta honestamente en vez de prometer algo que la elección de plataforma (Web/PWA) no permite todavía de forma madura y consistente entre navegadores.

### 10.3 Qué debe ser 100% cloud

Todo lo que implica comprensión de lenguaje natural, visión, o razonamiento — es decir, el catálogo completo de agentes de la Parte 5 — corre en la nube, contra la API de Anthropic, orquestado por el servidor Next.js (Parte 3). Justificación por eje:

- **Latencia:** aceptable — el propio diseño del Orchestrator (Parte 4.2.2) separa lo interactivo (segundos) de lo diferido (`after()`, sin bloquear al usuario) y de lo batch (minutos/horas, explícitamente no interactivo). No hay necesidad de inferencia local para cumplir la latencia percibida objetivo.
- **Costo:** un modelo cloud con precio por token, prompt caching y Batch API (Parte 9.3) es más predecible y más barato en la Fase 1 que operar infraestructura de inferencia propia, dado el volumen inicial de usuarios (Parte 18 desarrolla las cifras).
- **Privacidad:** se gestiona por diseño de datos (cifrado en tránsito y reposo, aislamiento por usuario, políticas de retención — Parte 19), no por mantener el procesamiento fuera del dispositivo. Es un control de gobernanza de datos, no una propiedad automática de "está en la nube = inseguro".
- **Escalabilidad:** un proveedor gestionado escala sin que el equipo de una persona tenga que operar GPUs — coherente con la restricción de equipo confirmada.

### 10.4 Qué podría volverse híbrido en el futuro (no ahora)

Documentado explícitamente como **fuera del alcance de la Fase 1**, para que quede trazable en el roadmap (Parte 21) sin generar expectativa prematura:

- **App nativa (fase 4-5):** con acceso a Apple Intelligence (Foundation Models framework) o Gemini Nano en Android, ciertas tareas ligeras (clasificación simple, redacción de una notificación) podrían moverse a inferencia on-device — reduciendo costo de API y mejorando privacidad percibida (el dato ni siquiera sale del dispositivo para esa tarea puntual). Esto requiere la existencia de la app nativa, que el usuario confirmó como posterior al Web/PWA.
- **WebGPU/WASM en el navegador (opción intermedia, especulativa):** existen runtimes que permiten correr modelos pequeños (clase Phi/Gemma) directamente en el navegador. Se descarta para la Fase 1 por madurez desigual entre navegadores/dispositivos y porque el beneficio (ahorro de costo en tareas ya baratas con Haiku 4.5) no compensa la complejidad de mantener un runtime de inferencia en el cliente para un equipo de una persona.
- **Self-hosting de modelos abiertos a gran escala:** solo se reconsideraría si el análisis de costos (Parte 18) mostrara, a un volumen muy alto de usuarios, que el costo marginal de infraestructura propia es claramente inferior al de la API gestionada — y solo si para ese momento el equipo ya no es de una sola persona (la operación de GPUs en producción no es viable en la restricción de equipo actual).

### 10.5 Resumen de la decisión

| Pregunta | Respuesta Fase 1 |
|---|---|
| ¿Hay LLM corriendo en el dispositivo del usuario? | No |
| ¿Todo el procesamiento de IA pasa por el servidor propio antes de llegar a Anthropic? | Sí — nunca el cliente llama directo a la API de IA (Parte 3.2) |
| ¿Se depende de un único proveedor de IA? | Para inferencia activa, sí (Anthropic) por decisión razonada (9.2); la arquitectura permite conmutar (9.1, 9.5) sin reescritura |
| ¿Cuándo se revisita esta decisión? | Ante caída de servicio sostenida, cambio de foco de producto hacia audio/video, o umbral de costo a escala (Parte 18) |
