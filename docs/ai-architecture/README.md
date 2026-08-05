# Arquitectura de IA de Agenda+

Documento técnico completo de arquitectura de la plataforma de Inteligencia Artificial de Agenda+, dividido en 12 archivos consecutivos. Es la base oficial de diseño antes de implementar código de IA — ningún archivo de esta carpeta contiene código ni diseño de interfaces, por decisión explícita del alcance del documento.

## Decisiones marco (condicionan todo el documento)

- **Plataforma:** Web/PWA primero; nativo (iOS/Android) en una fase posterior (Parte 21, Fase 5).
- **Modelo económico:** Freemium (gratis limitado + Pro), con routing de modelo y cuotas por plan diseñados desde el día uno (Parte 9, Parte 18).
- **Equipo:** una persona, tiempo completo — la arquitectura prioriza servicios gestionados (Supabase, Vercel, Anthropic) y evita infraestructura propia.
- **Proveedor de IA principal:** Anthropic Claude, con capa de abstracción que permite conmutar de proveedor sin reescribir agentes (Parte 9).
- **Los "agentes" se construyen sobre la Messages API + salidas estructuradas/tool use, no sobre Managed Agents (CMA)** — justificado en la Parte 3.4.

## Índice

| # | Archivo | Contenido (Partes del encargo original) |
|---|---|---|
| 1 | [00-resumen-y-filosofia.md](./00-resumen-y-filosofia.md) | Parte 1: análisis del problema del estudiante. Parte 2: filosofía de IA de Agenda+, comparación con ChatGPT/Gemini/Notion AI/Classroom/MyStudyLife/Calendar, cuándo intervenir y cuándo callar |
| 2 | [01-arquitectura-general.md](./01-arquitectura-general.md) | Parte 3: arquitectura general, diagramas de extremo a extremo, capas del sistema, por qué no Managed Agents |
| 3 | [02-orchestrator.md](./02-orchestrator.md) | Parte 4: el AI Orchestrator — selección de agente, prioridad, memoria, contexto, cancelación, concurrencia |
| 4 | [03-catalogo-agentes.md](./03-catalogo-agentes.md) | Parte 5: catálogo completo de agentes con responsabilidades, entradas, salidas, disparadores y modelo asignado |
| 5 | [04-flujo-informacion.md](./04-flujo-informacion.md) | Parte 6: flujos de información punta a punta (foto→recordatorio, documento→sesión de estudio, tiempo→proactividad) |
| 6 | [05-contexto-y-memoria.md](./05-contexto-y-memoria.md) | Parte 7: qué contexto recordar y cómo acotarlo. Parte 8: los seis tipos de memoria, qué guardar, qué olvidar, cómo resumir |
| 7 | [06-modelos-hibridos.md](./06-modelos-hibridos.md) | Parte 9: arquitectura híbrida de modelos (routing Haiku/Sonnet/Opus, rol de otros proveedores). Parte 10: local vs. cloud |
| 8 | [07-ocr-y-comprension.md](./07-ocr-y-comprension.md) | Parte 11: pipeline de OCR inteligente. Parte 12: pipeline de comprensión semántica texto→tarea estructurada |
| 9 | [08-planificacion-y-proactividad.md](./08-planificacion-y-proactividad.md) | Parte 13: replanificación automática de la semana. Parte 14: IA proactiva sin ser molesta. Parte 15: notificaciones inteligentes |
| 10 | [09-tutor-y-predicciones.md](./09-tutor-y-predicciones.md) | Parte 16: tutor inteligente (Study Coach) socrático. Parte 17: predicciones con confianza estadística honesta |
| 11 | [10-costos-privacidad-escalabilidad.md](./10-costos-privacidad-escalabilidad.md) | Parte 18: costos por escala de usuarios. Parte 19: arquitectura de privacidad y GDPR. Parte 20: escalabilidad a 10 años |
| 12 | [11-roadmap-riesgos-y-revision.md](./11-roadmap-riesgos-y-revision.md) | Parte 21: roadmap por fases. Parte 22: riesgos y mitigaciones. Parte 23: revisión crítica de la propia arquitectura |

## Cómo leer este documento

Está diseñado para leerse en orden — cada archivo referencia decisiones tomadas en los anteriores (ej. el catálogo de agentes de la Parte 5 asume el marco de confianza/utilidad/no-redundancia definido en la Parte 2.4). Si se necesita una referencia rápida sobre un tema puntual, la tabla de arriba indica en qué archivo vive cada Parte del encargo original.

El archivo [11-roadmap-riesgos-y-revision.md](./11-roadmap-riesgos-y-revision.md) — en particular su Parte 23 — es lectura obligatoria antes de tomar cualquier decisión de implementación: contiene la autocrítica de la arquitectura, incluyendo puntos débiles reales no resueltos (observabilidad no especificada, arranque en frío de predicciones, calibración de cuota potencialmente optimista).
