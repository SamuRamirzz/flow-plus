# Parte 6 — Flujo de información

> Documento 5 de 12. Ver [README.md](./README.md) para el índice completo.

## 6.1 Por qué esto merece su propio documento

El catálogo de agentes (Parte 5) describe cada pieza en aislamiento. Lo que determina si el sistema se siente inteligente o se siente como una colección de funciones desconectadas es **cómo fluye la información entre agentes, base de datos, calendario, recordatorios y memoria** — este documento traza los tres flujos punta a punta más representativos del sistema.

## 6.2 Flujo 1 — De foto a recordatorio (el flujo insignia, categoría A de la Parte 1)

```mermaid
flowchart TD
    F["Usuario toma/sube una foto\n(pizarra, apunte, aviso)"] --> UP["Upload a Supabase Storage\n+ Route Handler recibe referencia"]
    UP --> OCR["OCR Agent\n(Sonnet 5, vision)"]
    OCR --> EXT["Homework Agent / Exam Agent\n(comprensión semántica, Parte 12)"]
    EXT --> VAL{"¿Confianza suficiente\ny fecha plausible?"}
    VAL -->|"alta"| CAL["Calendar Agent\ncrea tarea/evento"]
    VAL -->|"media/baja"| SUG["Se publica como sugerencia\nen superficie pasiva\n(requiere confirmación)"]
    CAL --> CONF{"¿Colisiona con algo\nexistente?"}
    CONF -->|sí| CR["Conflict Resolver\npropone resolución"]
    CONF -->|no| DB[("tareas / examenes\n(Supabase)")]
    CR --> DB
    DB --> REM["Reminder Agent\ncalcula ventana de recordatorio"]
    REM --> NOT["Notification Agent\n(gate de las 3 condiciones, Parte 2.4)"]
    DB --> MEM["Orchestrator actualiza memoria\n(materia reforzada, patrón de carga)"]
    NOT -->|cumple condiciones| PUSH["Notificación al usuario"]
    NOT -->|no cumple| PASIVO["Queda visible en la app,\nsin interrumpir"]
```

Puntos de diseño que este flujo fija:

1. **La confianza se evalúa dos veces, no una**: primero al extraer (Homework/Exam Agent declara su propia confianza), y de nuevo al decidir el nivel de autonomía (Parte 4.2.5). Esto evita que un agente "seguro de sí mismo" pero equivocado escriba directo a la base de datos.
2. **El registro de memoria ocurre siempre**, incluso cuando el resultado termina como sugerencia sin confirmar — porque el patrón en sí (ej. "el usuario fotografía la pizarra de Física todos los lunes") es información útil para el Orchestrator aunque la tarea puntual no se haya creado todavía.
3. **El camino hasta la notificación es largo a propósito**: pasa por Reminder Agent (decide si debería existir un recordatorio) y luego por Notification Agent (decide si y cómo comunicarlo ahora). Nunca un agente notifica directamente — esto es lo que impide que cinco agentes generen cinco notificaciones independientes por un solo evento.

## 6.3 Flujo 2 — De documento largo a sesión de estudio (categoría D→E)

```mermaid
flowchart TD
    PDF["Usuario sube guía de examen (PDF)"] --> PA["PDF Agent\nsegmenta + detecta fechas embebidas"]
    PA --> DL["Deadline Analyzer\n¿hay fechas no capturadas?"]
    DL -->|sí| SUGF["Sugerencia: crear tarea\npara fecha encontrada"]
    PA --> SUM["Summarizer Agent\nresumen jerárquico + marcado examinable"]
    SUM --> FC["Flashcards Agent"]
    SUM --> QG["Quiz Generator\n(si hay Exam Agent con temario asociado)"]
    FC --> SPACED["Motor de repetición espaciada\n(Parte 16)"]
    QG --> COACH["Study Coach\nsesión guiada"]
    SPACED --> COACH
    COACH --> PRED["Predicciones de riesgo\n(Parte 17): ¿en qué está débil?"]
    PRED --> REC["Recommendation Agent\nsugiere próxima sesión de repaso"]
```

Este flujo es deliberadamente **asíncrono y de baja prioridad de cómputo**: el Summarizer, Flashcards y Quiz Generator de un documento largo no necesitan responder en segundos — se ejecutan vía Batch API (Parte 9) salvo que el usuario esté esperando activamente en la UI (ej. pidió "resume este PDF ahora"). La diferencia con el Flujo 1 (foto→recordatorio, que sí es mayormente interactivo) es clave para el diseño de costos (Parte 18): el 50% de descuento de Batch API se aplica exactamente a este tipo de flujo.

## 6.4 Flujo 3 — Del tiempo que pasa a la proactividad (categoría C, sin evento de usuario)

Este es el flujo que no tiene un disparador de usuario — nace del cron y de la observación pasiva de la base de datos, y es el que más distingue a Agenda+ de una app reactiva.

```mermaid
flowchart TD
    CRON["Cron diario/semanal\n(Vercel Cron → Route Handler)"] --> SNAP["Orchestrator toma snapshot:\ntareas, exámenes, patrón de completado"]
    SNAP --> PLAN["Planning Agent\nrecalcula distribución de la semana"]
    SNAP --> MOT["Motivation Agent\ndetecta postergación/inactividad"]
    SNAP --> PREDS["Predicciones (Parte 17):\nriesgo de sobrecarga, olvido"]
    PLAN --> GATE1{"¿Cambia sustancialmente\nel plan anterior?"}
    MOT --> GATE2{"¿Hay patrón de 2+\npostergaciones?"}
    PREDS --> GATE3{"¿Riesgo supera\numbral de confianza?"}
    GATE1 -->|sí| SUGP["Sugerencia de replanificación\n(superficie pasiva)"]
    GATE2 -->|sí| SUGM["Intervención breve\n(Notification Agent decide canal)"]
    GATE3 -->|sí, y accionable hoy| SUGR["Alerta de sobrecarga\n(Notification Agent)"]
    GATE1 -->|no| SILENCIO1["Silencio"]
    GATE2 -->|no| SILENCIO2["Silencio"]
    GATE3 -->|no| SILENCIO3["Silencio"]
```

El resultado por defecto de cada rama es **silencio** — se dibuja explícitamente en el diagrama porque es la ruta más frecuente en un sistema bien calibrado (Parte 2.4: la mayoría de los días, no debería pasar nada visible). Solo las ramas que superan su respectivo umbral llegan a generar contenido, y ese contenido pasa siempre por el Notification Agent antes de decidir el canal de entrega.

## 6.5 Principio transversal: la IA aprende contexto en cada flujo, no solo al final

En los tres flujos, el paso de "actualizar memoria" no es un paso final aislado — ocurre en paralelo a la acción principal (ver el nodo `MEM` en el Flujo 1). Esto es intencional: si la memoria solo se actualizara al completar todo el flujo, un flujo interrumpido (usuario cierra la app a medio proceso, o el resultado se descarta por baja confianza) perdería información de contexto que igual era valiosa (ej. "el usuario fotografía habitualmente los lunes" es cierto aunque esa foto en particular no haya generado una tarea). El diseño detallado de qué se guarda y cómo se resume se cubre en la Parte 8.
