# Parte 18-20 — Costos, privacidad y escalabilidad

> Documento 11 de 12. Ver [README.md](./README.md) para el índice completo.
>
> **Nota metodológica sobre la Parte 18:** las cifras de esta sección son estimaciones de orden de magnitud para planificación, construidas a partir de supuestos explícitos de uso (declarados en 18.2) y de los precios de Claude verificados en la Parte 9.3. No son una proyección financiera — cambiarán con datos reales de uso una vez la app tenga usuarios. Se presentan con supuestos visibles, coherente con el principio de la Parte 2.3 y la Parte 17 de nunca mostrar un número sin declarar su base.

## Parte 18 — Costos

### 18.1 Qué determina el costo de IA de Agenda+

El costo no es una función simple de "número de usuarios" — depende de: (a) cuántas invocaciones de agente genera un usuario activo por día, (b) qué mezcla de modelos consumen esas invocaciones (Haiku/Sonnet/Opus, Parte 9.3), (c) qué fracción de esas llamadas se benefician de prompt caching o de la Batch API (50% de descuento), y (d) la proporción de usuarios en el tier gratuito vs. Pro (freemium, decisión confirmada).

### 18.2 Supuestos de uso (declarados explícitamente)

| Supuesto | Valor asumido |
|---|---|
| Eventos de captura por usuario activo/día (fotos, texto, voz → Homework/Exam Agent + OCR + Calendar) | Free: 5 — Pro: 15 |
| Operaciones ligeras por evento de captura (Reminder + Notification + Time Estimation, Haiku 4.5) | 3 por evento de captura |
| Replanificación nocturna (Planning Agent, batch, Sonnet 5) | 1 por usuario activo/noche, ambos tiers |
| Sesiones de Study Coach (Opus 5, interactivo) por mes | Free: 0-2 (cuota estricta) — Pro: 8 |
| Documentos largos procesados (PDF Agent + Summarizer, Sonnet 5) por mes | Free: 2 — Pro: 10 |
| % de tokens de entrada servidos desde caché (system prompt fijo por agente) | ~60% en llamadas interactivas repetidas |

### 18.3 Costo estimado por unidad de trabajo (usando precios de la Parte 9.3)

| Unidad de trabajo | Modelo | Costo aproximado por ejecución |
|---|---|---|
| Captura completa (OCR + comprensión, imagen + texto) | Sonnet 5 | ~$0.01 |
| Operación ligera (Calendar/Reminder/Notification) | Haiku 4.5 | ~$0.0007 |
| Replanificación nocturna (batch, -50%) | Sonnet 5 (batch) | ~$0.007 |
| Sesión de Study Coach (varios turnos) | Opus 5 | ~$0.10 |
| Documento largo (PDF + resumen) | Sonnet 5 | ~$0.03 |

### 18.4 Costo mensual estimado por usuario activo

| Tier | Cálculo | Costo mensual aprox. |
|---|---|---|
| **Free** | (5 capturas × 30 × $0.01) + (5×3×30 × $0.0007) + (30 × $0.007) + (2 × $0.03) | ≈ **$2.0/usuario/mes** |
| **Pro** | (15 × 30 × $0.01) + (15×3×30 × $0.0007) + (30 × $0.007) + (8 × $0.10) + (10 × $0.03) | ≈ **$6.8/usuario/mes** |

### 18.5 Proyección por escala (asumiendo conversión freemium del 5% a Pro, cifra típica de referencia del sector — no medida)

| Usuarios totales | Free (95%) | Pro (5%) | Costo de IA estimado/mes |
|---|---|---|---|
| 10 | 9-10 | 0-1 | < $25 |
| 100 | 95 | 5 | ≈ $224 |
| 1,000 | 950 | 50 | ≈ $2,240 |
| 10,000 | 9,500 | 500 | ≈ $22,400 |
| 100,000 | 95,000 | 5,000 | ≈ $224,000 |
| 1,000,000 | 950,000 | 50,000 | ≈ $2,240,000 |

**Lectura honesta de esta tabla:** a escala de decenas de miles de usuarios, el costo de inferencia deja de ser trivial y debe cubrirse con el precio del tier Pro — el precio de suscripción Pro debe fijarse con margen sobre el costo real por usuario Pro (~$6.8/mes en este supuesto), no solo sobre el promedio. A escala de cientos de miles/millones de usuarios, esta arquitectura por sí sola no es sostenible sin optimización adicional — la sección 18.6 documenta las palancas concretas, y la Parte 20 documenta las decisiones estructurales que evitan tener que reescribir el sistema para aplicarlas.

### 18.6 Palancas de reducción de costo (en orden de cuándo aplicarlas)

1. **Ya incluidas desde el diseño (Fase 1):** routing por modelo (Haiku por defecto, Sonnet para el trabajo real, Opus solo donde se justifica — Parte 9.3), prompt caching sobre todo system prompt fijo (Parte 7.4), Batch API para todo trabajo no interactivo (replanificación, procesamiento masivo de documentos), cuotas estrictas de Opus en el tier free.
2. **A escala de miles de usuarios:** revisar y ajustar el % de contexto cacheable (auditar que ningún prompt esté invalidando el caché por incluir datos volátiles al inicio, ver Parte 7.4), comprimir imágenes antes de enviarlas a visión (reducir tokens de imagen sin perder legibilidad del texto).
3. **A escala de decenas/cientos de miles:** reevaluar la palanca ya anotada en la Parte 9.4 — desacoplar OCR tradicional (barato) de la comprensión semántica (LLM), reservando visión de LLM para los casos que el OCR tradicional falla; negociar tarifas por volumen con el proveedor si el contrato lo permite a esa escala.
4. **Solo si el equipo deja de ser de una persona (Parte 20):** evaluar self-hosting de modelos abiertos para las tareas de mayor volumen y menor complejidad (clasificación, Haiku-equivalente) — nunca antes, por la restricción de equipo confirmada.

### 18.7 Costo de infraestructura no-IA (referencia, no es el foco de este documento)

Vercel y Supabase tienen planes gratuitos que cubren la Fase 1 (10-100 usuarios) y planes de pago escalonados que crecen con el uso — su costo es secundario frente al de inferencia de IA a partir de la escala de miles de usuarios, y no se detalla aquí porque no es una decisión de arquitectura de IA.

---

## Parte 19 — Privacidad

### 19.1 Principio rector

El usuario fue explícito: no vender datos, transparencia, auditabilidad, cumplimiento GDPR y de estándares modernos. Esto se traduce en requisitos de arquitectura concretos, no en una política de privacidad redactada aparte del sistema.

### 19.2 Control del usuario sobre sus datos

- **Exportación:** el usuario debe poder exportar toda su información (tareas, materias, memoria, historial) en un formato estructurado (JSON) — requisito de portabilidad de datos (equivalente al artículo 20 del GDPR).
- **Eliminación:** el usuario debe poder eliminar su cuenta y todos los datos asociados, incluidas las imágenes/documentos originales almacenados y las entradas de memoria (Parte 8) — no solo "desactivar" la cuenta. Esto exige que el esquema de datos (introducido junto con Supabase Auth, Parte 3.6) tenga `user_id` como clave de borrado en cascada desde el diseño, no añadido después.
- **Corrección:** cualquier inferencia de la IA (una tarea creada, una materia detectada, un patrón de hábito) debe ser editable o descartable por el usuario — ya cubierto funcionalmente por el marco de niveles de autonomía (Parte 4.2.5), pero se reafirma aquí como requisito de privacidad, no solo de UX: los datos que la IA infiere sobre una persona no deberían ser inmutables para ella.

### 19.3 Transparencia y auditabilidad

- **Explicabilidad mínima:** toda sugerencia o acción autónoma de la IA debe poder responder a "¿por qué me sugirió esto?" con una razón concreta trazable (ej. "porque tienes examen de Química el jueves y no has abierto los apuntes") — esto es una consecuencia directa de cómo se diseñó el Orchestrator (Parte 4) y el marco de las tres condiciones (Parte 2.4): si el sistema no puede articular la razón, es señal de que la condición de utilidad no estaba realmente cumplida.
- **Registro de eventos de IA:** la tabla de eventos de IA introducida en la Parte 3.6 (qué se comunicó, cuándo, con qué confianza) no es solo infraestructura del Orchestrator — es también el sustento de auditabilidad frente al usuario y, si corresponde, frente a un regulador.
- **Sin caja negra de "por qué la app sabe esto":** toda entrada a la memoria (Parte 8) debe ser visible para el usuario en alguna superficie de configuración (aunque sea una vista simple de "esto es lo que Agenda+ recuerda de ti"), coherente con el principio de transparencia.

### 19.4 Minimización de datos

- Las imágenes/audio originales se conservan solo el tiempo necesario para procesamiento y verificación por el usuario, con una política de retención definida (no indefinida por defecto) — el dato persistente de valor a largo plazo es la estructura extraída (la tarea), no el archivo crudo, salvo que el usuario decida conservarlo explícitamente.
- La memoria (Parte 8) sigue explícitamente el criterio de "qué olvidar" ya definido — no se acumula indefinidamente por defecto.
- No se recopila ninguna señal fuera del dominio académico declarado por el usuario — nada de tracking de comportamiento ajeno al producto.

### 19.5 Relación contractual con el proveedor de IA

Requisito de procurement, no solo de código: el contrato/términos de servicio con el proveedor de modelos (Anthropic, Parte 9.2) debe garantizar explícitamente que los datos enviados vía API no se usan para entrenar modelos de terceros ni se comparten fuera del procesamiento de la solicitud — esto debe verificarse activamente contra los términos comerciales vigentes al momento de la implementación (no se asume aquí como hecho dado, se declara como condición que el equipo debe confirmar antes de procesar datos reales de usuarios). Si en el futuro se activa un segundo proveedor (Parte 9.5), la misma garantía debe exigirse antes de enrutarle tráfico real.

### 19.6 Aislamiento de datos entre usuarios

Con la introducción de Supabase Auth (Parte 3.6), cada fila de datos de dominio y de memoria debe estar protegida por políticas de seguridad a nivel de fila (Row-Level Security) de forma que un usuario nunca pueda, ni por error de aplicación ni por consulta directa, leer datos de otro usuario — esto es más estricto que "el código de la aplicación filtra por user_id" (frágil, un bug lo rompe) y debe aplicarse como garantía de la propia base de datos.

### 19.7 Cumplimiento GDPR — resumen de mapeo

| Derecho GDPR | Cómo se cumple en esta arquitectura |
|---|---|
| Acceso (Art. 15) | Vista de "qué recuerda Agenda+ de ti" (19.3) |
| Portabilidad (Art. 20) | Exportación estructurada (19.2) |
| Supresión / "derecho al olvido" (Art. 17) | Eliminación en cascada por `user_id` (19.2, 19.6) |
| Rectificación (Art. 16) | Toda inferencia es editable (19.2) |
| Minimización (Art. 5.1.c) | Política de retención de archivos crudos y de memoria (19.4) |
| Limitación de tratamiento a la finalidad declarada (Art. 5.1.b) | No se procesan datos fuera del dominio académico (19.4); garantía contractual con el proveedor de IA (19.5) |

---

## Parte 20 — Escalabilidad a 10 años

### 20.1 El error a evitar: optimizar para la escala equivocada hoy

La restricción de equipo (una persona) significa que la arquitectura correcta para hoy **no** es la que soporta mejor 10 millones de usuarios desde el primer commit — es la que **no exige una reescritura** cuando el crecimiento llegue. Esta es una distinción importante: sobre-construir para una escala que no existe (colas propias, microservicios, modelos autoalojados) hoy sería tan mal diseño como no pensar en escala en absoluto.

### 20.2 Decisiones de hoy que evitan una reescritura mañana

| Decisión tomada en este documento | Por qué previene una reescritura futura |
|---|---|
| Orchestrator con contrato de agente declarativo (Parte 4.4), no lógica ad hoc por Route Handler | Añadir un agente nuevo, cambiar el modelo de uno existente, o introducir un segundo proveedor (Parte 9.5) es un cambio de configuración/registro, no una reescritura de la lógica de negocio |
| Servidor stateless (toda la lógica de servidor en Route Handlers/Server Actions sin estado en memoria del proceso) | Permite escalar horizontalmente sin rediseño — el runtime serverless de Vercel ya hace esto automáticamente; ninguna decisión de este documento depende de que dos peticiones consecutivas caigan en el mismo proceso |
| Salidas estructuradas validadas por esquema (JSON Schema vía `output_config.format`, Parte 12.3) | El esquema de cada agente puede versionarse igual que un esquema de base de datos; un cambio de modelo o proveedor no rompe silenciosamente el contrato de datos porque la validación es explícita |
| Memoria por niveles con compactación (Parte 8), no acumulación indefinida de contexto crudo | El costo y la latencia de contexto no crecen sin límite con la antigüedad de la cuenta de un usuario — una cuenta de 5 años de uso no cuesta 5 años de tokens de contexto |
| Base de datos relacional (Postgres/Supabase) con `user_id` y RLS desde el diseño (Parte 19.6) | Postgres escala razonablemente bien hasta un volumen alto de usuarios antes de necesitar particionamiento — se pospone esa complejidad hasta que los datos reales de uso justifiquen evaluarla |
| Routing de modelo y proveedor abstraído (Parte 9.1) | Un cambio de proveedor por costo, capacidad, o regulación de residencia de datos no exige reescribir cada agente — se cambia en el registro |
| Diseño de costos con cuotas desde el día uno (Parte 18) | El control de costo por usuario no es un parche añadido a escala — ya es parte del contrato de cada agente desde la Parte 4.4 |

### 20.3 Qué se pospone deliberadamente (y cuándo revisitarlo)

- **Particionamiento/sharding de base de datos:** no se diseña ahora; se revisita cuando el volumen de filas en las tablas de dominio o de eventos de IA lo justifique con datos reales de rendimiento, no antes.
- **Búsqueda semántica/embeddings (RAG) sobre el contenido del usuario:** el Search Agent (Parte 5.6) hoy funciona sobre datos estructurados y documentos ya indexados de forma simple; si el volumen de contenido por usuario crece lo suficiente (años de apuntes, cientos de documentos), se revisita introducir una capa de embeddings para búsqueda semántica — no se construye preventivamente sin ese volumen.
- **Residencia de datos multi-región:** si Agenda+ escala a mercados con requisitos de residencia de datos (ej. la UE), se revisita la configuración de región tanto de Supabase como de las llamadas a la API de IA — se documenta como punto de revisión, no como requisito actual dado que la Fase 1 no tiene usuarios en mercados con ese requisito confirmado.
- **Self-hosting de modelos:** como ya se estableció (Parte 9.4, Parte 18.6), solo se reconsidera si el equipo crece más allá de una persona y el análisis de costo a escala lo justifica con datos reales.

### 20.4 La prueba de la década

El criterio de validación de esta arquitectura no es "¿soporta un millón de usuarios hoy?" (no lo necesita) sino: **¿puede un desarrollador dentro de 5 años, con un equipo más grande, tomar cada una de las decisiones pospuestas en 20.3 sin descartar el trabajo hecho en esta fase?** Cada fila de la tabla en 20.2 está diseñada para responder que sí — son puntos de extensión, no muros que haya que derribar.
