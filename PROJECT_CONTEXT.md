# Contexto de Flow Plus (leer antes de trabajar en este proyecto)

Este archivo existe para que cualquier sesión futura de Claude Code tenga de inmediato el mismo entendimiento del proyecto que se construyó leyendo el repositorio completo. Se carga automáticamente porque `CLAUDE.md` lo importa. Si algo aquí contradice lo que ves en el código real, **el código manda** — actualiza este archivo, no al revés.

## Qué es Flow Plus

**Nombre real del proyecto: Flow Plus** (dominio `flowplus.space`), renombrado en un sprint dedicado sobre lo que antes se llamó "AgendaHub" (y antes de eso "Agenda+"/"Agenda" — documentos/código de sprints anteriores a este renombrado pueden usar cualquiera de esos nombres, es el mismo proyecto). **Dentro de la UI de la app se usa la forma abreviada "Flow+"** (wordmark en `/login` y el `<h1>` de la pantalla principal); la forma completa "Flow Plus" se reserva para metadata técnica (`package.json`, `<title>`) y documentación formal — esta distinción se aplica de forma consistente, no son sinónimos intercambiables. `docs/ai-architecture/` (fase de diseño cerrada, ver más abajo) deliberadamente **no** se tocó en este renombrado — sigue usando "Agenda+" como referencia histórica del documento original; si hace falta consistencia total ahí también, es una decisión aparte que el usuario no ha pedido todavía.

Aplicación de agenda académica personal ("Agenda universitaria"), en español, pensada para un estudiante. El objetivo declarado del producto (ver `docs/ai-architecture/`) es evolucionar hacia un asistente de IA **ambiental y proactivo** — al estilo Apple Intelligence, no un chatbot. **Ya existe una primera experiencia real de IA** (pantalla `/ai`, Sprint 2) — sigue siendo texto→tareas únicamente, no la visión completa del documento de arquitectura. Estado siempre actualizado en [ROADMAP.md](ROADMAP.md).

## Estado real del proyecto (lo que existe hoy)

- **Un solo commit** en git (`Initial commit from Create Next App`); todo lo demás (`app/*` modificado, `components/`, `lib/`, `docs/`) está sin commitear.
- **La app entera es un solo archivo cliente**: [app/page.tsx](app/page.tsx) tiene toda la lógica (carga de datos, CRUD, filtros, stats, modal). Es `'use client'`, sin excepción.
- **Cero backend.** No hay `app/api/`, no hay Server Actions, no hay `proxy.ts`. El cliente habla directo con Supabase usando la clave anónima pública (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`).
- **Cero autenticación.** No hay usuarios, no hay `user_id` en las tablas, no hay Row-Level Security conocida. Es de un solo usuario; el nombre "Samuel" está hardcodeado en el saludo (`app/page.tsx`, función `saludo()`).
- **Persistencia:** Supabase Postgres, dos tablas: `materias` (`id`, `nombre`, `color`, `created_at`) y `tareas` (`id`, `titulo`, `materia_id`, `fecha_entrega` string `YYYY-MM-DD` o null, `prioridad` string libre pero la UI solo usa `baja|media|alta`, `completada` boolean). No hay migraciones ni esquema versionado en el repo — el esquema real vive solo en Supabase.
- **Sin tipos compartidos.** `Materia` y `Tarea` se redefinen a mano, idénticos, en al menos 6 archivos (`app/page.tsx`, `AddTaskBar`, `TaskTable`, `AgendaSummary`, `DayGroup`, `DayDetailModal`, `NotificationBell`). No existe `lib/types.ts`. Cualquier cambio de esquema exige tocar todos esos archivos a mano.
- **Patrón de datos:** fetch-refetch total. `cargarDatos()` en `page.tsx` hace `Promise.all` de `materias` + `tareas` al montar; cada mutación (`agregarTarea`, `toggle`, `eliminarTarea`, `editarTarea`) escribe en Supabase y vuelve a llamar `cargarDatos()` completo. No hay actualización optimista, no hay caché, no hay revalidación selectiva.
- **La única "inteligencia" existente hoy** es una heurística fija en `components/ui/NotificationBell.tsx`: ventana de aviso por prioridad (alta=3 días, media=2, baja=1 antes de vencer), recalculada en cada render, sin IA ni contexto del usuario.

## Stack técnico exacto

- **Next.js 16.2.11** (App Router, sin `src/`), **React 19.2.4**. `next.config.ts` está vacío (sin `cacheComponents`, sin `typedRoutes`, sin dominios de imagen).
- **IMPORTANTE — Next.js 16 rompe supuestos de entrenamiento del modelo.** `AGENTS.md` (importado por este `CLAUDE.md`) exige leer `node_modules/next/dist/docs/` antes de cualquier trabajo de Next.js: `middleware.ts` ahora es `proxy.ts`, existen `cacheComponents`/`use cache`, `after()`, `output_config.format` para salidas estructuradas de IA no aplica a Next per se pero es igual de importante no asumir APIs viejas. Verifica siempre contra los docs empaquetados, no contra memoria de entrenamiento.
- **Tailwind CSS v4**, CSS-first (`@theme inline` en `app/globals.css`), sin `tailwind.config.js`. Tokens: `ink, panel, panel-2, panel-glass, line, coral (#FF6B4D), paper, muted, danger, success`; fuentes `display` (Space Grotesk), `body` (Inter), `mono` (JetBrains Mono).
- **Directiva de diseño global no negociable** (`app/globals.css`): `*, *::before, *::after { border-width: 0 !important; }` — cero bordes duros en todo el proyecto, para siempre. Los paneles se distinguen por `backdrop-blur` + sombra, nunca por líneas. Cualquier `border-*` de Tailwind que se use en JSX queda anulado a propósito; no es un bug.
- **Tema dark/light** vía `lib/theme.tsx` (`ThemeProvider`/`useTheme`), persistido en `localStorage['agenda-theme']`, aplicado como `data-theme` en `<html>`. Dark es el default y el más cuidado visualmente (el fondo `LightRaysBackground` con shader WebGL solo se monta en dark).
- **`@supabase/supabase-js`** (cliente browser, `lib/supabase.ts`), **`@headlessui/react`**, **`lucide-react`**, **`motion`** (Framer Motion v12, importado como `motion/react`), **`ogl`** (WebGL, solo para `LightRays`).
- **Sin**: state manager (Zustand/Redux/Jotai), sin zod/react-hook-form, sin ORM, sin test runner, sin `--turbopack` en el script `dev`.
- `tsconfig.json`: `strict: true`, alias `@/*` → raíz del repo (no hay `src/`).

## Estructura de archivos y qué hace cada cosa

### `app/`
- `page.tsx` — la app entera (ver arriba).
- `layout.tsx` — Server Component mínimo: envuelve en `ThemeProvider` → `ToastProvider`, monta `LightRaysBackground`, `ThemeToggle`, `AppSidebar` (fijos, fuera del flujo de `children`), y `NavDock` al final.
- `globals.css` — tokens de tema + directiva de cero-bordes + estilos puntuales de `Dock`.

### `lib/`
- `supabase.ts` — cliente único, exportado como `supabase`.
- `theme.tsx` — contexto de tema.
- `toast.tsx` — contexto de notificaciones toast (`useToast().notify(mensaje, exito?)`), con cola, `createPortal` a `document.body`, autodescarta a los 3.2s. **Este es el canal ya existente para dar feedback de acciones** — cualquier feature nueva (incluida IA) debería reusar esto antes de inventar un sistema de mensajes propio.
- `color.ts` — `hexToHSL()`, usado por `TaskCard` (huérfano) para el color del glow.

### `components/` — activos (importados desde `page.tsx`, `layout.tsx`, o `app/ai/page.tsx`)
- `AddTaskBar.tsx` — formulario de captura manual de tarea: `MateriaPicker`, input de título, date picker, toggle de prioridad, botón agregar.
- `TaskTable.tsx` + `TaskRow.tsx` — tabla de tareas activa hoy (reemplazó al patrón de cards por día).
- `MiniCalendar.tsx` — calendario mensual, punto con tarea, click abre `DayDetailModal`.
- `AgendaSummary.tsx` — "Próximas entregas" (siguientes 4 por fecha) + barra "Por materia" (conteo de pendientes).
- `AppSidebar.tsx` (usa `ui/Sidebar.tsx`) — navegación flotante desktop, expande en hover, **route-aware vía `usePathname()`** (Sprint 2). "Agenda" (`/`) e "IA" (`/ai`) son reales; Calendario/Pendientes/Materias/Estadísticas/Ajustes siguen en `href="#"`. `ui/Sidebar.tsx`'s `SidebarLink` usa `next/link` (antes `<a>` plano — se cambió al dejar de haber una sola página real).
- `NavDock.tsx` (usa `reactbits/Dock.jsx`) — dock estilo macOS, solo móvil (`lg:hidden`). 5 items: Inicio (navega a `/` si no estás ahí, si no hace scroll-to-top), **IA** (`router.push('/ai')`), Materias (scroll a `#tareas`), 2 placeholders "pronto".
- `ThemeToggle.tsx` — botón sol/luna fijo arriba-derecha.
- `reactbits/LightRaysBackground.tsx` (usa `LightRays.jsx`, shader WebGL vía `ogl`) — fondo animado, solo en dark mode.
- `ui/MateriaPicker.tsx` — selector de materia + "nueva materia" inline (Sprint 2, extraído de `AddTaskBar` para reusarlo también en `ResultTaskRow`). Cualquier control de materia nuevo debería usar este, no reinventarlo.
- `ui/PremiumSelect.tsx`, `ui/PremiumDatePicker.tsx`, `ui/NotificationBell.tsx`, `ui/DayDetailModal.tsx` — todos siguen el **mismo patrón repetido sin abstraer**: `createPortal(document.body)` + posición manual vía `getBoundingClientRect()` + animación spring de `motion/react`. Si se toca uno, probablemente haya que tocar los otros para mantener consistencia.
- `ui/SegmentedToggle.tsx` — switch tipo iOS con píldora animada por `layoutId`, usado para prioridad.
- `reactbits/BorderGlow.jsx` — efecto de brillo de borde que sigue al cursor (rAF + CSS vars), envuelve `AddTaskBar` y `TaskCard` (este último huérfano).
- `ai/ResultTaskRow.tsx` — fila editable inline de una tarea detectada por IA (título/materia/fecha/prioridad, sin modales), usada solo en `app/ai/page.tsx`.

### `components/` — **huérfanos, no importados por nadie desde `page.tsx`**
`AgendaTabs.tsx`, `SubjectTabs.tsx`, `DayGroup.tsx`, `TaskCard.tsx`. Son restos de una iteración de UI anterior (vista de tarjetas agrupadas por día con pestañas Hoy/Semana/Próxima semana) que se abandonó por el `TaskTable` actual. Compilan y no tienen bugs conocidos, pero **no asumas que están en uso** ni los actualices "de pasada" al tocar tipos compartidos, salvo que el usuario pida explícitamente resucitarlos.

### `docs/ai-architecture/`
Documento completo de arquitectura de IA (12 archivos + README) — es la especificación oficial (fase de diseño cerrada, no se rediseña salvo problema crítico). Índice y decisiones marco en [docs/ai-architecture/README.md](docs/ai-architecture/README.md). Resumen de las decisiones que más importan para cualquier trabajo futuro de IA:
- Plataforma: Web/PWA primero, nativo después.
- Modelo económico: freemium, con cuotas por plan desde el diseño.
- Equipo: una persona — se prioriza todo lo gestionado (Vercel, Supabase, Anthropic), se evita infraestructura propia.
- Proveedor de IA: Claude (Anthropic) como principal, vía **Messages API + salidas estructuradas / tool use**, explícitamente **no** Managed Agents (CMA) — ver Parte 3.4 del documento.
- Routing de modelo: Haiku 4.5 para tareas ligeras, Sonnet 5 como caballo de batalla (extracción, planificación, visión), Opus 5 solo para el tutor (Study Coach).
- Catálogo de ~20 agentes especializados orquestados por un "AI Orchestrator" propio (no un framework de terceros).
- Roadmap conceptual: Fase 0 (auth + tipos compartidos + límite de servidor, sin IA) → Fase 1 (captura: OCR/Homework/Calendar/Reminder) → Fase 2 (planificación/proactividad) → Fase 3 (herramientas de estudio) → Fase 4 (tutor/predicciones) → Fase 5 (nativo).

**Ya hay implementación real** (esto sí cambia sprint a sprint — el estado autoritativo y siempre actualizado vive en [ROADMAP.md](ROADMAP.md), léelo para saber qué está construido antes de asumir nada):
- `lib/ai/` completo: types (incluye `defaultProviderId` en el contrato de agente desde Sprint 2), errors, config (incluye `geminiApiKey`), events (`AIEventBus`), providers (`ProviderRegistry` + **`GeminiProvider` real**), agents (`AgentRegistry`), context (`ContextEngine`, lanza a propósito — Fase 2 sin implementar), parser (**`HomeworkOutputParser`, primera implementación real**), orchestrator (`AIOrchestrator` con dispatch/execute/health reales, `execute()` resuelve el proveedor del agente y se lo pasa a `run()`).
- `lib/ai/agents/homework/` — `HomeworkAgent` llama a **Gemini 3.5 Flash-Lite** con salida JSON forzada (modelo actualizado en Sprint 3, era 2.5 Flash-Lite en Sprint 2). Ya no hay mock — `extractHomeworkMock.ts` se eliminó en Sprint 2.
- `lib/ai/bootstrap.ts` — punto único que los Route Handlers llaman para registrar proveedores + agentes (reemplaza llamar `registerAgents()`/`registerProviders()` por separado).
- `app/api/ai/health` y `app/api/ai/homework` — ya no son solo de prueba: `app/ai/page.tsx` (pantalla real, Sprint 2) los consume.
- `lib/tasks.ts` — `crearTarea()`, lógica de creación de tareas (+ materia nueva si hace falta, con deduplicación por nombre) compartida entre `AddTaskBar`/`page.tsx` y la pantalla `/ai`.
- Requiere `GEMINI_API_KEY` en `.env.local` (server-only) para funcionar de verdad — **no configurada en este entorno**; sin ella, `HomeworkAgent` falla de forma controlada (verificado: `AgentResult` con `status: "error"`, nunca crashea).
- Vitest configurado (`vitest.config.mts`, scripts `test`/`test:watch`) — 8 tests, ninguno llama a la red real (usan un `AIProvider` falso inyectado).

## Deuda técnica y riesgos conocidos (no son bugs a "arreglar sin que te lo pidan", pero sí hay que tenerlos presentes)

1. Clave anónima de Supabase expuesta en cliente sin RLS confirmada — cualquiera con la key puede leer/escribir todo.
2. Sin auth ni `user_id` — `POST /api/ai/homework` opera con un `userId` hardcodeado (`"dev-user"`); bloqueante real para cuota o memoria por usuario.
3. Patrón de overlay (portal + posición manual + motion) repetido en varios componentes sin abstraer.
4. 4 componentes huérfanos que no se deben confundir con código activo.
5. `next.config.ts` vacío — nada de `cacheComponents`, sin optimizar imágenes, etc.
6. **`npm run lint` nunca ha pasado limpio** — 3 errores de la regla `react-hooks/set-state-in-effect` preexistentes desde antes de cualquier sprint de IA, en `lib/theme.tsx`, `components/ui/PremiumSelect.tsx` y `app/page.tsx` (línea del `useEffect` de carga inicial, no las líneas que se han tocado en los sprints de IA). Descubierto en Sprint 2 al correr `npm run lint` completo por primera vez — nadie lo había hecho antes. No se tocó porque son 3 archivos no relacionados con el sprint en curso y merecen su propio arreglo cuidadoso, no uno apurado.

## Cómo se abordó la integración de IA (histórico) y qué sigue

El plan original (Fase 0 tipos → primer límite de servidor → un solo flujo vertical → auth solo cuando haga falta) se siguió tal cual a lo largo de 3 sprints: Fase 0 (tipos compartidos), Sprint 0 (infraestructura `lib/ai/` completa sin ningún proveedor), Sprint 1 (`HomeworkAgent` end-to-end con mock, valida el pipeline), Sprint 2 (`GeminiProvider` real + pantalla `/ai` completa). Ver [ROADMAP.md](ROADMAP.md) para el detalle exacto de qué fase/ítem corresponde a cada sprint.

Lo que sigue siendo cierto para cualquier trabajo de IA futuro:
1. **Auth sigue sin ser bloqueante técnico pero cada vez pesa más** — `/api/ai/homework` funciona hoy con un `userId` fijo; el próximo agente que necesite memoria o cuota por usuario sí lo bloquea de verdad.
2. **No usar Managed Agents de Anthropic** — sigue aplicando; los agentes de este proyecto son llamadas acotadas de extracción/estructuración, no sesiones largas con sandbox.
3. **No tocar los componentes huérfanos** como parte de trabajo de IA.
4. **Reusar antes de crear** — `lib/tasks.ts`, `components/ui/MateriaPicker.tsx`, `useToast()` ya existen para lo que hacen; un agente/pantalla nueva que necesite crear tareas o elegir materia debería usarlos, no reinventarlos.
5. **Un agente = un `AIProviderId` declarado en su `AIAgentDefinition.defaultProviderId`** (Sprint 2) — el Orchestrator resuelve el proveedor y se lo pasa a `run()`; un agente nunca debe importar `ProviderRegistry` ni tocar `process.env` directamente, toda config pasa por `lib/ai/config`.

## Notas de colaboración con el usuario

- El usuario escribe y espera respuestas en **español**.
- Es un proyecto personal/solo — decisiones de arquitectura deben asumir un solo desarrollador manteniendo todo, no un equipo.
- El usuario ya validó y aprobó el documento completo de arquitectura de IA en `docs/ai-architecture/` — trátalo como la referencia de diseño vigente salvo que él indique lo contrario.
