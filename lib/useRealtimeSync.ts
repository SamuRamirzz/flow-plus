'use client'

import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { EventoRealtime } from '@/lib/realtimeReconciliar'

export type { EventoRealtime } from '@/lib/realtimeReconciliar'

type Tabla = 'tareas' | 'horario' | 'materias' | 'notificaciones'

// Sincronización en tiempo real entre dispositivos (Parte C del documento
// de auditoría/realtime). Reemplaza el snippet propuesto en el encargo,
// que usaba la API de Realtime v1 (`.from(table).on('*', cb).subscribe()`)
// — retirada hace años. Firma real verificada contra
// node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.d.ts de la
// versión instalada (2.110.8):
//   channel.on('postgres_changes', {event,schema,table,filter}, cb)
//
// A diferencia del snippet del encargo, `userId` NO lo pasa el llamador:
// se resuelve acá mismo con `getClaims()` (mismo patrón que ya usa
// lib/storage.ts para lo mismo), así que un componente que quiere
// suscribirse no tiene que resolverlo por su cuenta primero.
//
// `filter: user_id=eq.<uid>` es el mecanismo de scoping — determinista,
// no depende de si la réplica de Realtime aplica RLS de la misma forma
// que una consulta normal (la RLS de las tablas, ya cerrada en
// 20260804000000_rls_propietario.sql, es la segunda capa, no la única).
//
// Requiere que la tabla esté en la publicación `supabase_realtime` — ver
// 20260808000100_realtime_tareas_horario_materias.sql (tareas/horario/
// materias) y 20260819000000_notificaciones.sql (notificaciones, que
// además nace con REPLICA IDENTITY FULL desde el principio, sin repetir la
// investigación que encontró ese bug para las 3 tablas originales). Sin
// esto, el canal se suscribe pero nunca recibe nada (no es un error
// silencioso: la migración es la que lo habilita en el servidor).
export function useRealtimeSync<T extends { id: string }>(tabla: Tabla, activo: boolean, onEvento: (evento: EventoRealtime<T>) => void): void {
  // `onEvento` en un ref: evita que cada render del componente que llama
  // a este hook (que suele pasar una función nueva cada vez, ej. un
  // closure sobre `setState`) fuerce una resuscripción del canal — solo
  // `tabla`/`activo`/el `userId` resuelto deben reabrir la conexión.
  //
  // Actualizar el ref DENTRO de un efecto (no directo en el cuerpo del
  // render) — mutar un ref durante el render dispara
  // react-hooks/refs ("Cannot access refs during render").
  const onEventoRef = useRef(onEvento)
  useEffect(() => {
    onEventoRef.current = onEvento
  })

  useEffect(() => {
    if (!activo) return
    let cancelado = false
    let canal: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const { data } = await supabase.auth.getClaims()
      const userId = data?.claims?.sub
      if (cancelado || typeof userId !== 'string' || userId.length === 0) return

      canal = supabase
        .channel(`sync-${tabla}-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabla, filter: `user_id=eq.${userId}` },
          (payload: RealtimePostgresChangesPayload<T>) => {
            if (payload.eventType === 'INSERT') onEventoRef.current({ tipo: 'INSERT', fila: payload.new as T })
            else if (payload.eventType === 'UPDATE') onEventoRef.current({ tipo: 'UPDATE', fila: payload.new as T })
            else if (payload.eventType === 'DELETE') onEventoRef.current({ tipo: 'DELETE', fila: payload.old as T })
          }
        )
        .subscribe()
    })()

    return () => {
      cancelado = true
      if (canal) void supabase.removeChannel(canal)
    }
  }, [tabla, activo])
}
