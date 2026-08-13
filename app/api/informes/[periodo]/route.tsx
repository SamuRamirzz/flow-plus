import { renderToBuffer } from '@react-pdf/renderer'
import { requerirUsuario } from '@/lib/server/usuario'
import { clienteDeSesion } from '@/lib/server/sesion'
import { errorJson } from '@/lib/server/respuestas'
import { cargarDatosCrudosInforme, generarPuntosClave } from '@/lib/server/informes'
import { calcularDatosInforme } from '@/lib/informes/calcular'
import { esPeriodo } from '@/lib/informes/tipos'
import { nombreArchivoInforme } from '@/lib/informes/formato'
import { InformeDocumento } from '@/lib/informes/pdf/InformeDocumento'
import { registrarFuentes } from '@/lib/informes/pdf/tema'
import { hoyEnZona } from '@/lib/ai/context/fecha'

// Sprint 18a — GET /api/informes/[periodo]?fecha=YYYY-MM-DD
//
// Devuelve el PDF como binario. El PDF se genera SIEMPRE: la sección de IA es
// lo único que puede fallar, y su fallo cae al fallback determinístico sin
// tocar el resto del documento.

type Contexto = { params: Promise<{ periodo: string }> }

// El render de PDF no es instantáneo y la llamada a la IA suma segundos. El
// tope de los crons existentes de este proyecto es 60 s; se usa el mismo.
export const maxDuration = 60

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { periodo } = await params
  if (!esPeriodo(periodo)) {
    return errorJson('El periodo debe ser semanal, mensual o anual', 400)
  }

  // `?fecha=` permite generar el informe de un periodo pasado. Se valida el
  // formato: un string arbitrario acá produciría rangos sin sentido en vez de
  // un error legible.
  const fechaParam = new URL(request.url).searchParams.get('fecha')
  if (fechaParam !== null && !FORMATO_FECHA.test(fechaParam)) {
    return errorJson('El parámetro "fecha" debe tener formato YYYY-MM-DD', 400)
  }

  try {
    const supabase = await clienteDeSesion()
    const { data: claimsData } = await supabase.auth.getClaims()

    const crudos = await cargarDatosCrudosInforme(auth.userId, claimsData?.claims)

    // ⚠️ hoyEnZona, NUNCA hoyISOLocal(): en el servidor el reloj del proceso
    // es UTC, y para un usuario en America/Bogota eso ya es "mañana" después
    // de las 19:00 — el informe saldría con el periodo equivocado.
    const fechaReferencia = fechaParam ?? hoyEnZona(new Date(), crudos.zonaHoraria)

    const datos = calcularDatosInforme({
      periodo,
      fechaReferencia,
      nombreUsuario: crudos.nombreUsuario,
      tareas: crudos.tareas,
      materias: crudos.materias,
      archivos: crudos.archivos,
      notas: crudos.notas,
    })

    // La IA es lo ÚNICO que puede fallar acá, y no puede impedir que el PDF
    // salga: `generarPuntosClave` nunca lanza y siempre devuelve un texto
    // (validado del modelo, o el determinístico). Ver lib/server/informes.ts.
    const { texto: puntosClave, origen } = await generarPuntosClave(auth.userId, datos)

    registrarFuentes()
    const buffer = await renderToBuffer(<InformeDocumento datos={datos} puntosClave={puntosClave} />)

    const nombre = nombreArchivoInforme(periodo, datos.rango)
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        // RFC 5987, igual que app/api/archivos/[id]/route.ts: `filename` en
        // ASCII para clientes viejos, `filename*` en UTF-8 para el resto.
        'content-disposition': `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'cache-control': 'no-store',
        // Diagnóstico: si los puntos clave los escribió el modelo o si entró
        // el texto determinístico. No cambia nada del PDF — sirve para poder
        // verificar el comportamiento de la IA sin adivinar mirando la prosa.
        'x-puntos-clave': origen,
      },
    })
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    console.error('[api/informes] no se pudo generar el informe:', error)
    return errorJson(`No se pudo generar el informe: ${detalle}`, 500)
  }
}
