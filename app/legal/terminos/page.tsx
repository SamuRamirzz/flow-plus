import type { Metadata } from 'next'
import { Bot, FolderOpen, ShieldAlert, Scale, AlertTriangle } from 'lucide-react'
import EncabezadoLegal from '@/components/legal/EncabezadoLegal'
import IndiceLegal, { type ItemIndice } from '@/components/legal/IndiceLegal'
import PiePaginaLegal from '@/components/legal/PiePaginaLegal'
import TituloSeccion from '@/components/legal/TituloSeccion'
import Destacado from '@/components/legal/Destacado'
import { P, Lista, Item, Fuerte } from '@/components/legal/Texto'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Flow+',
  description: 'Las reglas de uso de Flow+: qué podés esperar del servicio, tus responsabilidades y los límites de la IA.',
}

const ACTUALIZADO = '6 de agosto de 2026'

const ITEMS: ItemIndice[] = [
  { id: 'aceptacion', numero: '01', titulo: 'Aceptación de los términos' },
  { id: 'que-es', numero: '02', titulo: 'Qué es Flow+' },
  { id: 'cuentas', numero: '03', titulo: 'Elegibilidad y cuentas' },
  { id: 'invitado', numero: '04', titulo: 'Modo invitado' },
  { id: 'ia', numero: '05', titulo: 'Uso de la Inteligencia Artificial' },
  { id: 'contenido', numero: '06', titulo: 'Tu contenido' },
  { id: 'drive', numero: '07', titulo: 'Integración con Google Drive' },
  { id: 'conducta', numero: '08', titulo: 'Conducta prohibida' },
  { id: 'propiedad', numero: '09', titulo: 'Propiedad intelectual de Flow+' },
  { id: 'disponibilidad', numero: '10', titulo: 'Disponibilidad del servicio' },
  { id: 'responsabilidad', numero: '11', titulo: 'Limitación de responsabilidad' },
  { id: 'terminacion', numero: '12', titulo: 'Terminación de cuenta' },
  { id: 'ley', numero: '13', titulo: 'Ley aplicable' },
  { id: 'cambios', numero: '14', titulo: 'Cambios a estos términos y contacto' },
]

export default function TerminosServicioPage() {
  return (
    <>
      <EncabezadoLegal activo="terminos" />

      <header className="max-w-2xl mb-14">
        <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-coral mb-3">Documento legal</span>
        <h1 className="font-display text-[32px] sm:text-[42px] font-semibold text-paper tracking-tight leading-[1.1] mb-4">
          Términos de Servicio
        </h1>
        <P>
          Estas son las reglas que rigen el uso de Flow+. Las escribimos para ser claras, no para esconder nada — si algo te genera dudas,
          escribinos antes de aceptar.
        </P>
      </header>

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-16">
        <IndiceLegal items={ITEMS} />

        <div className="min-w-0">
          <section className="mb-14">
            <TituloSeccion numero="01" id="aceptacion">
              Aceptación de los términos
            </TituloSeccion>
            <P>
              Al crear una cuenta o usar Flow+ (incluido el modo invitado) aceptás estos Términos de Servicio y nuestra{' '}
              <a href="/legal/privacidad" className="text-coral hover:underline">
                Política de Privacidad
              </a>
              . Si no estás de acuerdo con alguno de los dos, no deberías usar el servicio.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="02" id="que-es">
              Qué es Flow+
            </TituloSeccion>
            <P>
              Flow+ es una aplicación de agenda académica pensada para estudiantes, con asistencia de inteligencia artificial: te ayuda a
              registrar tareas, materias y horario, guardar archivos y notas, e interactuar con un asistente de IA sobre todo eso.
            </P>
            <P>
              Es un <Fuerte>proyecto personal</Fuerte>, mantenido y operado por una sola persona — no una empresa. Está en desarrollo
              activo: algunas funciones pueden cambiar, mejorar o, en casos puntuales, dejar de estar disponibles temporalmente.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="03" id="cuentas">
              Elegibilidad y cuentas
            </TituloSeccion>
            <Lista>
              <Item>Si tenés menos de 14 años, necesitás la autorización de un padre, madre o representante legal para crear una cuenta (ver la sección de menores de la Política de Privacidad).</Item>
              <Item>Sos responsable de mantener segura tu sesión y de toda la actividad que ocurra en tu cuenta.</Item>
              <Item>La información que nos das (nombre, correo, etc.) debe ser real — no crees una cuenta con datos de otra persona.</Item>
              <Item>Cada cuenta es personal e intransferible.</Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="04" id="invitado">
              Modo invitado
            </TituloSeccion>
            <P>
              Podés usar Flow+ sin crear una cuenta. Estos mismos términos aplican igual mientras usás ese modo. Tus datos, en ese caso,
              viven solo en tu navegador — ver la sección de modo invitado de la Política de Privacidad para el detalle completo.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="05" id="ia">
              Uso de la Inteligencia Artificial
            </TituloSeccion>
            <Destacado icono={Bot} titulo="La IA te ayuda, no te reemplaza el criterio" tono="pendiente">
              El asistente de Flow+ usa un modelo de lenguaje (Gemini, de Google) que <Fuerte>puede cometer errores</Fuerte>: interpretar
              mal una fecha, resumir de forma imprecisa un documento, o no detectar correctamente una tarea. Flow+{' '}
              <Fuerte>no reemplaza tu criterio académico</Fuerte> ni el de tus profesores — revisá siempre lo que la IA propone antes de
              darlo por bueno, especialmente en fechas de entrega y de examen.
            </Destacado>
            <P>
              Qué tipo de contenido tuyo procesa la IA, y qué pasa con él, está descrito en detalle en la sección correspondiente de la
              Política de Privacidad — la resumimos acá: texto que escribís o dictás, fotos de tu horario, y archivos que subís cuando
              pedís que se analicen.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="06" id="contenido">
              Tu contenido
            </TituloSeccion>
            <P>
              Las tareas, notas, archivos y todo lo demás que creás en Flow+ son <Fuerte>tuyos</Fuerte>. Al usar el servicio, nos das el
              permiso mínimo necesario para guardar ese contenido, procesarlo (incluido enviarlo a la IA cuando lo pedís) y mostrártelo de
              vuelta — nada más. No lo usamos para entrenar modelos propios (Flow+ no entrena ningún modelo de IA propio, solo llama a
              Gemini), ni lo revendemos, ni lo mostramos a otros usuarios.
            </P>
            <P>
              Sos responsable del contenido que subís: no debe infringir los derechos de otra persona, ni ser contenido ilegal. Ver también
              la sección de conducta prohibida.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="07" id="drive">
              Integración con Google Drive
            </TituloSeccion>
            <Destacado icono={FolderOpen} titulo="Un permiso acotado, y reversible en cualquier momento">
              Si conectás Google Drive, Flow+ pide el permiso <Fuerte>drive.file</Fuerte> — solo puede ver y modificar los archivos que la
              propia app crea dentro de una carpeta &ldquo;Flow+&rdquo; en tu Drive, nunca el resto de tus archivos. Podés desconectar Google Drive
              cuando quieras desde Ajustes; al hacerlo, los archivos que ya se habían subido <Fuerte>se quedan en tu Drive</Fuerte> (son
              tuyos), Flow+ simplemente pierde el acceso a ellos.
            </Destacado>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="08" id="conducta">
              Conducta prohibida
            </TituloSeccion>
            <P>Al usar Flow+, aceptás no:</P>
            <Lista>
              <Item>Subir contenido ilegal, difamatorio o que infrinja derechos de propiedad intelectual de terceros.</Item>
              <Item>Intentar vulnerar la seguridad de la aplicación o acceder a datos de otros usuarios.</Item>
              <Item>Usar el asistente de IA para generar contenido dañino, engañoso o destinado a hacer trampa académica en formas que infrinjan las políticas de tu institución.</Item>
              <Item>Automatizar el uso del servicio de forma que sobrecargue nuestra infraestructura o la de nuestros proveedores.</Item>
              <Item>Compartir tu cuenta con terceros o hacer ingeniería inversa de la aplicación.</Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="09" id="propiedad">
              Propiedad intelectual de Flow+
            </TituloSeccion>
            <P>
              El código, el diseño y la marca &ldquo;Flow+&rdquo; son propiedad de quien opera el servicio. Estos términos no te dan ningún derecho
              sobre ellos más allá del uso normal de la aplicación como usuario. Tu propio contenido académico sigue siendo tuyo, como se
              explica en la sección 06.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="10" id="disponibilidad">
              Disponibilidad del servicio
            </TituloSeccion>
            <P>
              Hacemos un esfuerzo razonable por mantener Flow+ disponible y funcionando correctamente, pero es un proyecto en desarrollo
              activo mantenido por una sola persona: pueden ocurrir interrupciones, errores o cambios de funcionalidad sin aviso previo. No
              garantizamos disponibilidad ininterrumpida ni un tiempo de actividad mínimo (sin SLA).
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="11" id="responsabilidad">
              Limitación de responsabilidad
            </TituloSeccion>
            <Destacado icono={ShieldAlert} titulo="Sos responsable de tus fechas de entrega" tono="pendiente">
              Flow+ es una herramienta de apoyo. En la medida permitida por la ley, no somos responsables por consecuencias académicas
              (entregas tardías, exámenes perdidos, notas afectadas) derivadas de un error de la IA, una falla del servicio, o un
              recordatorio que no llegó a mostrarse a tiempo. <Fuerte>La responsabilidad final de conocer y cumplir tus fechas académicas
              es siempre tuya</Fuerte> — Flow+ te ayuda a organizarte, no sustituye esa responsabilidad.
            </Destacado>
            <P>
              Tampoco somos responsables por pérdida de datos causada por fallas de terceros (nuestros proveedores de infraestructura) que
              estén fuera de nuestro control razonable, aunque tomamos medidas de seguridad activas para minimizar ese riesgo (ver la
              Política de Privacidad).
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="12" id="terminacion">
              Terminación de cuenta
            </TituloSeccion>
            <P>
              Podés dejar de usar Flow+ cuando quieras. Podemos suspender o cerrar el acceso a una cuenta que incumpla estos términos
              (sección 08), avisando cuando sea razonablemente posible hacerlo.
            </P>
            <P>
              Como se explica en la Política de Privacidad, hoy no existe un botón de autoservicio para borrar completamente tu cuenta —
              podés solicitarlo escribiéndonos, y lo procesamos manualmente mientras esa función no esté construida.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="13" id="ley">
              Ley aplicable
            </TituloSeccion>
            <Destacado icono={Scale} titulo="Jurisdicción">
              Estos términos se rigen por las leyes de la República de Colombia, incluida la Ley 1581 de 2012 sobre protección de datos
              personales. Cualquier disputa relacionada con el uso de Flow+ se resolverá conforme a la legislación colombiana.
            </Destacado>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="14" id="cambios">
              Cambios a estos términos y contacto
            </TituloSeccion>
            <P>
              Podemos actualizar estos términos a medida que Flow+ evoluciona. Cuando lo hagamos, actualizaremos la fecha al pie de esta
              página. El uso continuado del servicio después de un cambio implica que lo aceptás.
            </P>
            <P>Para cualquier duda sobre estos términos, escribinos — ver el correo al pie de esta página.</P>
          </section>

          <Destacado icono={AlertTriangle} titulo="Un aviso honesto sobre este documento" tono="pendiente">
            Este documento fue redactado con investigación real sobre cómo funciona Flow+ y sobre la normativa colombiana aplicable, con
            asistencia de IA. No reemplaza una revisión por parte de un abogado — si Flow+ crece más allá de un proyecto personal, vale la
            pena que estos términos y la Política de Privacidad pasen por esa revisión.
          </Destacado>

          <PiePaginaLegal actualizado={ACTUALIZADO} />
        </div>
      </div>
    </>
  )
}
