import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { ImmersiveProvider } from "@/lib/immersive";
import { AjustesModalProvider } from "@/lib/ajustesModal";
import { PreferenciasProvider, type Preferencias } from "@/lib/preferencias";
import { CuentaEliminacionProvider, type EstadoCuentaEliminacion } from "@/lib/cuentaEliminacion";
import BannerEliminacionCuenta from "@/components/BannerEliminacionCuenta";
import LightRaysBackground from "@/components/reactbits/LightRaysBackground";
import NavDock from "@/components/NavDock";
import ThemeToggle from "@/components/ThemeToggle";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/ui/NotificationBell";
import AjustesModal from "@/components/ajustes/AjustesModal";
import SincronizadorInvitado from "@/components/invitado/SincronizadorInvitado";
import ModeTransition from "@/components/ModeTransition";
import { getUserIdOpcional } from "@/lib/server/usuario";
import { supabaseServer } from "@/lib/server/supabaseServer";
import { ZONA_HORARIA_POR_DEFECTO } from "@/lib/ai/context/fecha";

export const metadata: Metadata = {
  title: "Flow Plus",
  description: "Agenda universitaria con IA",
};

// Sprint Landing — la navegación de la app solo se monta si hay sesión.
//
// Hasta ahora bastaba con esconderla por ruta (`esRutaDeEntrada`, que cubre
// /login y /bienvenida), pero `/` pasó a servir DOS cosas distintas según la
// sesión (ver app/page.tsx), y la ruta por sí sola ya no alcanza para saber
// cuál de las dos se está viendo. Este layout es un Server Component, así que
// aquí sí se sabe: sin sesión no se renderiza el sidebar ni el dock — ni
// siquiera se mandan al cliente.
//
// Sección Ajustes — mismo criterio server-side para PreferenciasProvider:
// se reusa el `userId` que ya resuelve `haySesion` (sin pedirlo dos veces) y
// se consulta perfil_academico directo acá, evitando un fetch client-side
// extra y el parpadeo de "24h"/zona por defecto mientras carga. Sin sesión,
// `inicial` queda en `null` — el provider cae a sus propios defaults, y
// ninguna página pública muestra una hora con preferencia de usuario, así
// que es inofensivo.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const userId = await getUserIdOpcional()
  const haySesion = userId !== null

  // Una sola consulta a `perfil_academico` alimenta preferencias Y el estado
  // de eliminación de cuenta — son la misma fila, pedirla dos veces sería
  // una consulta de servidor desperdiciada en cada carga de página.
  const perfilInicial = userId
    ? await supabaseServer
        .from('perfil_academico')
        .select('zona_horaria, formato_reloj, eliminacion_solicitada_en, eliminar_drive_tambien')
        .eq('user_id', userId)
        .maybeSingle()
        .then((r) => r.data)
    : null

  const preferenciasIniciales: Preferencias | null = userId
    ? {
        zonaHoraria: perfilInicial?.zona_horaria ?? ZONA_HORARIA_POR_DEFECTO,
        formatoReloj: (perfilInicial?.formato_reloj as Preferencias['formatoReloj']) ?? '24h',
      }
    : null

  const cuentaEliminacionInicial: EstadoCuentaEliminacion | null = userId
    ? {
        solicitada: perfilInicial?.eliminacion_solicitada_en != null,
        solicitadaEn: perfilInicial?.eliminacion_solicitada_en ?? null,
        eliminarDriveTambien: perfilInicial?.eliminar_drive_tambien ?? null,
      }
    : null

  return (
    <html lang="es">
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <PreferenciasProvider inicial={preferenciasIniciales}>
              <CuentaEliminacionProvider inicial={cuentaEliminacionInicial}>
                <ImmersiveProvider>
                  <AjustesModalProvider>
                    <LightRaysBackground />
                    <ThemeToggle />
                    {/* Campana global — antes vivía solo dentro de
                        AgendaHome (visible únicamente en /agenda); una
                        notificación de horario o de una nota no tiene por
                        qué esconderse detrás de esa pantalla en particular.
                        Gateada por sesión real como el resto de la
                        navegación: modo invitado no tiene backend de
                        notificaciones (usa localStorage, sin fila de
                        usuario que el cron pueda procesar). */}
                    {haySesion && <NotificationBell />}
                    {/* Franja de "cuenta pendiente de eliminación" — se
                        renderiza siempre que hay sesión; se esconde sola si
                        no hay ninguna solicitud activa (ver el guard dentro
                        del propio componente). */}
                    {haySesion && <BannerEliminacionCuenta />}
                    {haySesion && <AppSidebar />}
                    <ModeTransition>{children}</ModeTransition>
                    {haySesion && <NavDock />}
                    {/* Ajustes dejó de ser una ruta: se monta una sola vez acá
                        y se abre desde el sidebar (desktop) o el dock (móvil),
                        encima de la pantalla en la que estés. Mismo criterio de
                        sesión que la navegación — sin sesión no hay ajustes que
                        mostrar. */}
                    {haySesion && <AjustesModal />}
                    {/* Modo invitado — si hay datos locales de una sesión de
                        invitado previa, se sincronizan solos apenas hay sesión
                        real. Cubre cualquier pantalla autenticada, no solo
                        /bienvenida (ver components/invitado/SincronizadorInvitado.tsx). */}
                    {haySesion && <SincronizadorInvitado />}
                  </AjustesModalProvider>
                </ImmersiveProvider>
              </CuentaEliminacionProvider>
            </PreferenciasProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
