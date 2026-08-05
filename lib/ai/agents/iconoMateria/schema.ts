import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import { ICONOS_VALIDOS, ICONO_POR_DEFECTO, type NombreIcono } from '@/lib/materias/asignarIcono'

// Lista cerrada — literalmente el mismo enum que usa el mapeo
// determinístico (lib/materias/asignarIcono.ts), no una paralela: si se
// agrega un ícono nuevo a un lado, el otro lo ve automáticamente.
export const ICONO_MATERIA_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    icono: {
      type: 'string',
      enum: ICONOS_VALIDOS,
      description:
        'El ícono de lucide-react que mejor representa visualmente esta materia académica. Si ninguno calza bien, usa "GraduationCap".',
    },
  },
  required: ['icono'],
}

export type IconoMateriaParsedOutput = { icono: NombreIcono }

// Nunca lanza — mismo criterio que el resto de OutputParser en este
// proyecto. Cualquier desvío (JSON inválido, ícono fuera del enum cerrado)
// cae al ícono por defecto en vez de propagar el error: esto es un
// respaldo COSMÉTICO, jamás debe poder tumbar la creación de una materia.
export class IconoMateriaOutputParser implements OutputParser<IconoMateriaParsedOutput> {
  parse(raw: unknown): ParseResult<IconoMateriaParsedOutput> {
    if (typeof raw !== 'string') {
      return { ok: true, data: { icono: ICONO_POR_DEFECTO } }
    }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: true, data: { icono: ICONO_POR_DEFECTO } }
    }

    if (typeof json !== 'object' || json === null) {
      return { ok: true, data: { icono: ICONO_POR_DEFECTO } }
    }

    const icono = (json as Record<string, unknown>).icono
    const valido = ICONOS_VALIDOS.includes(icono as NombreIcono)
    return { ok: true, data: { icono: valido ? (icono as NombreIcono) : ICONO_POR_DEFECTO } }
  }
}
