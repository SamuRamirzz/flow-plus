# Sub-sprints pendientes (diseñados — ver estado real abajo, YA NO todos pendientes)

> ⚠️ **Corrección (segunda auditoría de cierre de Fase 1, 2026-07-30):** el
> título de este archivo y cada prompt de abajo dicen "NO iniciado" — eso
> dejó de ser cierto para los 5 sub-sprints en algún punto anterior a esta
> fecha, sin que este archivo se actualizara. Verificado leyendo el código
> real (componentes montados, endpoints wireados) y, para 7.3/8.2/8.3,
> probando en vivo contra Gemini real: **7.3, 7.4, 7.5, 8.2 y 8.3 están
> construidos.** El detalle de qué se verificó de cada uno vive en
> [ROADMAP.md](ROADMAP.md), sección "Segunda auditoría de cierre de Fase 1".
> El contenido de diseño de cada sub-sprint se deja intacto abajo como
> registro histórico de las decisiones tomadas — no como una lista de
> pendientes.

Este archivo existe para no perder el trabajo de diseño ya hecho sin inflar
el contexto que se carga en cada sesión (`CLAUDE.md` NO importa este
archivo — solo `ROADMAP.md` lo referencia). Contiene los prompts completos
tal como se escribieron originalmente. **Antes de "reabrir" cualquiera de
estos sub-sprints, lee primero la corrección de arriba y `ROADMAP.md` — es
muy probable que ya esté hecho.**

Origen: el 2026-07-27 el usuario juntó una lista larga y suelta de ideas
(visión en `/ai`, voz, edición de horario, limpiar horario, conflicto al
importar horario, selector de hora propio, animaciones en `/horario`,
rediseño del panel de tareas en `/ai`) y pidió agruparlas por sprint para
que la IA no intente hacerlas todas a la vez. Quedaron agrupadas por
afinidad técnica (qué código tocan), no por orden de mención.

Dos ideas se dejaron **fuera** de esta lista a propósito porque el propio
usuario dijo que no era urgente diseñarlas todavía: una sección de
**Ajustes** de la app, y una sección de **Historial** de conversaciones con
la IA. Cuando el usuario quiera retomarlas, hay que diseñarlas con calma
antes de convertirlas en un prompt — no colarlas en medio de otro sub-sprint.

Orden sugerido: 8.2 antes que 8.3 (8.3 reusa el editor de bloque que
construye 8.2). El resto no tiene dependencias entre sí.

---

## 7.3 — Visión en `/ai` (fotos/PDF de tareas) — ✅ CONSTRUIDO

```markdown
# Sub-sprint 7.3 — Adjuntar foto o PDF de una tarea en /ai

## Contexto obligatorio
Relee `lib/ai/providers/gemini/GeminiProvider.ts` y `construirInput.ts` (ya
extendidos en el Sprint 8 para aceptar adjuntos de imagen, usados hoy solo por
`ClassScheduleAgent`), y `app/ai/page.tsx`/`AIImmersiveOverlay.tsx`. La
capacidad de visión del provider ya existe — este sub-sprint la conecta a
`/ai` (tareas), que hasta ahora solo la usaba `/horario`.

## Objetivo
En `/ai`, además de escribir texto, el usuario puede adjuntar una imagen o PDF
de una tarea (ej. foto de un enunciado en el tablero, una hoja de instrucciones,
una captura de un portal universitario) y que `HomeworkAgent`/el agente de
gestión de tareas la lea y proponga la(s) tarea(s) igual que hoy hace con texto.

## Diseño
- UI: en "la parte para escribir a la IA" (el bloque ya nombrado así en
  sprints anteriores), agrega una forma de adjuntar archivo (botón clip/cámara,
  igual de simple que el de "Importar foto" en `/horario`).
- Reusa la misma subida a Supabase Storage + reducción en cliente ya construida
  en el Sprint 8 — no dupliques ese código, extráelo a un helper compartido si
  hoy vive solo dentro del flujo de horario.
- El texto y la imagen pueden combinarse en un mismo mensaje (ej. usuario
  adjunta la foto Y escribe "esto es para el lunes") — el agente debe poder
  recibir ambos en la misma llamada.
- Si el usuario está en una conversación con turnos ya construida (Sub-sprint
  7.2), el adjunto se agrega como parte de ese turno, sin romper el historial
  de turnos previos de solo texto.
- Verifica si conviene un modelo distinto para este caso (mismo criterio que
  se usó en Sprint 8 al comparar `flash-lite` vs `flash` para el horario) —
  documenta la decisión, no asumas que el mismo modelo de texto sirve igual.

## Restricciones
- No toques la lógica de `/horario` ya construida — esto es exclusivamente
  el flujo de `/ai`.
- Sin librerías nuevas, TypeScript estricto, tokens existentes.

## Qué entregar
1. Botón de adjuntar en la parte para escribir a la IA.
2. Subida/reducción de imagen reusada (extraída a helper compartido si aplica).
3. Agente recibiendo imagen + texto combinados.
4. Prueba manual real: foto de una tarea de verdad (o mock razonable) →
   confirma que se crea correctamente.
5. `tsc --noEmit`, `eslint`, `vitest run` limpios.
```

---

## 7.4 — Entrada por voz — ✅ CONSTRUIDO (transcripción real de audio no verificable en navegador automatizado, ver `lib/ai/useDictado.ts`)

```markdown
# Sub-sprint 7.4 — Dictado por voz en /ai

## Contexto obligatorio
Relee "la parte para escribir a la IA" en `app/ai/page.tsx`. Este sub-sprint
es independiente de todo lo demás — solo agrega una forma alterna de llenar
el mismo textarea que ya existe.

## Objetivo
Un botón de micrófono junto al textarea que, al presionarse, transcribe lo
que el usuario dice en tiempo real (o al soltar, decide cuál se siente mejor)
y lo va llenando en el textarea — el usuario puede seguir editando el texto
después normalmente, como si lo hubiera escrito.

## Diseño
- Usa la Web Speech API del navegador (`SpeechRecognition`) — no requiere
  librería nueva ni backend, es nativa del navegador. Verifica soporte (no
  todos los navegadores la implementan igual, ej. Firefox tiene soporte
  limitado) y degrada con gracia (oculta o deshabilita el botón) si no está
  disponible, sin romper nada.
- Configura el idioma en español (`es-CO` o similar).
- Ícono de micrófono con estado visual claro: inactivo, escuchando (alguna
  animación sutil, ej. pulso), procesando.
- El texto transcrito se agrega al textarea, no lo reemplaza si ya había
  algo escrito.

## Restricciones
- Sin librerías nuevas — Web Speech API es nativa.
- Tokens existentes, cero bordes duros.

## Qué entregar
1. Botón de micrófono funcional en la parte para escribir a la IA.
2. Manejo de error/no-soporte sin romper la UI.
3. Prueba manual real hablando una tarea completa y confirmando que se
   transcribe razonablemente bien.
4. `tsc --noEmit`, `eslint` limpios.
```

---

## 8.2 — Editar bloque + limpiar horario + conflicto al importar — ✅ CONSTRUIDO

```markdown
# Sub-sprint 8.2 — Edición inline, limpiar horario, y resolución de conflictos al importar

## Contexto obligatorio
Relee la grilla de `/horario` rediseñada en el ajuste anterior, `lib/horario/
{cargar,mutar,diff}.ts`, y `ClassScheduleAgent`. Este sub-sprint retoma un
pendiente que quedó explícitamente anotado: "el clic-para-editar no existía,
dime si la quieres y la hago" — sí se quiere, va aquí.

## PARTE A — Edición inline de un bloque
- Clic en una celda con contenido → abre edición (mismo patrón ya usado en
  otros overlays del proyecto: portal + posición manual + motion, o el
  criterio que ya estableciste al rediseñar la grilla) para materia, hora
  inicio/fin, aula, profesor.
- `aula`/`profesor` existen en la tabla `horario` pero no en el tipo
  `BloqueHorario` del cliente (según lo ya documentado) — agrégalos al tipo.
- Usa el endpoint `actualizarBloqueHorario` que ya existe (confirmado que
  el backend lo soporta, solo faltaba exponerlo en la UI).

## PARTE B — Botón "Limpiar horario"
- Botón visible en `/horario` que borra todos los bloques del usuario.
- Requiere confirmación explícita (no un borrado de un solo clic) — puede
  ser un diálogo simple o un patrón de "mantener presionado"/doble clic,
  decide el que mejor calce con el resto del proyecto (sin bordes duros,
  sigue los tokens).

## PARTE C — Conflicto al importar un horario nuevo sobre uno existente
Cuando el usuario importa una foto y ya existe un horario guardado, hoy
`diff.ts` solo lista cambios; no ofrece decisión. Este sub-sprint agrega:
- Si hay bloques existentes, antes de aplicar la propuesta, preguntar:
  **reemplazar todo** (borrar el horario viejo, quedarse con el nuevo),
  **descartar la propuesta** (quedarse con el viejo), o **fusionar**
  (combinar ambos).
- Al fusionar: si una franja del horario nuevo cae en el mismo día/hora que
  una del horario viejo pero con **materia distinta**, es un conflicto real
  que debe mostrarse al usuario explícitamente, uno por uno, para que decida
  cuál de las dos mantener (no una regla automática silenciosa) — usa
  `lib/horario/diff.ts` como base y extiéndelo si hace falta para detectar
  este caso específico (mismo tramo, distinta materia), no solo
  agregado/eliminado/movido.

## Restricciones
- No cambies la forma de los datos de `horario` salvo por agregar
  `aula`/`profesor` al tipo (ya existen en la tabla).
- Reusa los endpoints ya existentes, no dupliques lógica de escritura.
- Sin librerías nuevas, tokens existentes, cero bordes duros.

## Qué entregar
1. Edición inline funcional (materia/hora/aula/profesor).
2. Botón "Limpiar horario" con confirmación.
3. Flujo de conflicto al importar (reemplazar/descartar/fusionar +
   resolución de conflictos por franja).
4. Tests de la lógica de detección de conflicto (pura, en `diff.ts` o
   similar).
5. Prueba manual real: importar un horario nuevo sobre uno existente y
   probar las 3 rutas (reemplazar, descartar, fusionar con conflicto real).
6. `tsc --noEmit`, `eslint`, `vitest run` limpios.
```

---

## 8.3 — Pulido visual de `/horario` — ✅ CONSTRUIDO (animaciones no medidas frame a frame en esta auditoría)

```markdown
# Sub-sprint 8.3 — Selector de hora propio + animaciones en /horario

## Contexto obligatorio
Hazlo **después** del Sub-sprint 8.2 (edición inline), ya que el selector de
hora se usa justo ahí. Relee el componente de edición construido en 8.2.

## PARTE A — Selector de hora propio
El usuario adjuntó una captura del selector de hora nativo del navegador
(feo, inconsistente con el diseño del resto de la app — dos columnas
scrolleables de hora/minuto con AM/PM). Reemplázalo por un componente propio
de Flow+ que siga los mismos tokens del proyecto (`panel`, `panel-glass`,
cero bordes duros, fuente `mono` para los números). Revisa si ya existe un
patrón similar en `PremiumDatePicker` (para fechas) y sigue el mismo criterio
de diseño para consistencia, adaptado a hora en vez de fecha.

## PARTE B — Animaciones de entrada/salida en /horario
Hoy la grilla no tiene ninguna transición al cargar ni al cambiar. Usa Framer
Motion (`motion/react`, ya en el proyecto) para:
- Entrada suave de la grilla al cargar la página (fade/blur sutil, mismo
  lenguaje visual usado en el overlay de `/ai`).
- Transición al cambiar de día en la vista móvil (selector de día).
- Transición al abrir/cerrar la edición inline de un bloque (del 8.2).

## Restricciones
- Sin librerías nuevas.
- No cambies el comportamiento funcional de nada, solo la presentación.

## Qué entregar
1. Selector de hora propio integrado en la edición inline.
2. Animaciones de entrada/salida en los 3 puntos mencionados.
3. Prueba manual en desktop y móvil.
4. `tsc --noEmit`, `eslint` limpios.
```

---

## 7.5 — Rediseño del panel de tareas en `/ai` — ✅ CONSTRUIDO

```markdown
# Sub-sprint 7.5 — Rediseñar el panel de tareas dentro de /ai

## Contexto obligatorio
Relee el panel de tareas actual (columna derecha del overlay y el panel
post-cierre en la página principal de `/ai`, construidos en sprints
anteriores). Es un ajuste puramente visual — toda la lógica (highlight de
creadas/modificadas/eliminadas, undo, fetch de tareas reales) debe seguir
funcionando exactamente igual.

## Objetivo
El usuario indica que esta sección "no se ve muy bonita" hoy. Rediseña la
presentación de la lista de tareas (tipografía, espaciado, jerarquía visual
entre las categorías creada/modificada/eliminada, tratamiento de los chips
"antes → después" y el botón "Deshacer") usando los tokens ya establecidos,
buscando que se sienta tan cuidado como el resto de `/ai` (el overlay, la
parte para escribir a la IA ya rediseñada).

## Restricciones
- No cambies ninguna lógica — undo, highlight, fetch siguen igual.
- Cero bordes duros, tokens existentes, sin librerías nuevas.

## Qué entregar
1. Panel de tareas rediseñado, visualmente consistente con el resto de /ai.
2. Confirmación de que undo y las 3 categorías siguen funcionando igual.
3. `tsc --noEmit`, `eslint` limpios.
```

---

## Pendientes de diseñar (no convertidos en prompt todavía)

- ~~**Sección de Ajustes**~~ — ✅ **construida** (2026-08-07) y rediseñada
  como modal flotante estilo macOS System Settings (2026-08-08, con
  buscador y 6 categorías). Ver `ROADMAP.md`.
- **Historial de conversaciones con la IA** — guardar y poder revisar
  conversaciones pasadas de `/ai`. Ligado a memoria persistente (Fase 0/2 de
  `ROADMAP.md`), diseñar junto con eso cuando se retome.
- **Modo invitado (sin cuenta, datos en localStorage + sync al registrarse)**
  — encargo recibido y revisado el 2026-08-08, **pospuesto a propósito**
  (decisión del usuario: no es bloqueante de lanzamiento, y el bloqueante
  real — facturación de Gemini, ver `ROADMAP.md` — sigue sin resolver).
  El spec original tenía 3 problemas reales encontrados contra el código
  antes de escribir nada, que hay que corregir si se retoma:
  1. Nombres de campo equivocados (`title`/`name` en vez de `titulo`/
     `nombre` — `lib/types.ts`), señal de que no se leyó el schema real.
  2. La sincronización al registrarse NO puede hacer
     `supabase.from(...).insert()` desde el cliente — la migración
     `20260801000000_revocar_escrituras_anon.sql` revocó escritura a
     `anon`/`authenticated` a propósito; solo `service_role` (server-side)
     escribe. Necesita un Route Handler nuevo.
  3. El alcance es mucho mayor de lo que el encargo sugería: desde el
     Sprint 6 toda mutación pasa por Route Handlers con `requerirUsuario()`
     (401 sin sesión), y `proxy.ts` ya redirige sin sesión en toda ruta de
     página — "modo invitado" implica abrir ese candado a propósito Y
     escribir una segunda implementación completa de cada mutación en
     localStorage, en paralelo a la que ya existe. La promesa de que "la
     IA funciona en modo invitado" es falsa tal como está la arquitectura
     hoy (cada agente persiste vía Route Handlers autenticados) — si se
     retoma, la decisión ya tomada es que la IA quede fuera de modo
     invitado (exige login), mismo criterio que notificaciones/realtime.
