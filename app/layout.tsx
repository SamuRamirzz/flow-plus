import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { ImmersiveProvider } from "@/lib/immersive";
import { AjustesModalProvider } from "@/lib/ajustesModal";
import { PreferenciasProvider, type Preferencias } from "@/lib/preferencias";
import LightRaysBackground from "@/components/reactbits/LightRaysBackground";
import DotFieldBackground from "@/components/reactbits/DotFieldBackground";
import NavDock from "@/components/NavDock";
import ThemeToggle from "@/components/ThemeToggle";
import AppSidebar from "@/components/AppSidebar";
import AjustesModal from "@/components/ajustes/AjustesModal";
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

  const preferenciasIniciales = userId
    ? await (async () => {
        const { data } = await supabaseServer
          .from('perfil_academico')
          .select('zona_horaria, formato_reloj')
          .eq('user_id', userId)
          .maybeSingle()
        return {
          zonaHoraria: data?.zona_horaria ?? ZONA_HORARIA_POR_DEFECTO,
          formatoReloj: (data?.formato_reloj as Preferencias['formatoReloj']) ?? '24h',
        }
      })()
    : null

  return (
    <html lang="es">
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            <PreferenciasProvider inicial={preferenciasIniciales}>
              <ImmersiveProvider>
                <AjustesModalProvider>
                  <LightRaysBackground />
                  <DotFieldBackground />
                  <ThemeToggle />
                  {haySesion && <AppSidebar />}
                  <ModeTransition>{children}</ModeTransition>
                  {haySesion && <NavDock />}
                  {/* Ajustes dejó de ser una ruta: se monta una sola vez acá
                      y se abre desde el sidebar (desktop) o el dock (móvil),
                      encima de la pantalla en la que estés. Mismo criterio de
                      sesión que la navegación — sin sesión no hay ajustes que
                      mostrar. */}
                  {haySesion && <AjustesModal />}
                </AjustesModalProvider>
              </ImmersiveProvider>
            </PreferenciasProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
