# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SIGE sirve a una comunidad escolar multirol: superadministración de la plataforma, administración y dirección de cada colegio, secretaría, docentes, personal de apoyo, familias y estudiantes. Cada persona necesita operar únicamente los módulos y datos que corresponden a su rol y colegio.

## Product Purpose

Centralizar la gestión académica, administrativa y familiar de uno o varios colegios privados en un sistema confiable. El éxito significa que cada rol puede completar su trabajo diario desde una experiencia coherente, que la información permanece aislada por colegio y que la plataforma puede administrarse tanto desde la web como desde la aplicación móvil.

## Positioning

SIGE combina operación escolar multirol, administración multicoledio y acompañamiento mediante un personaje institucional adaptable a la identidad de cada colegio.

## Operating Context

El sistema se usa durante jornadas escolares para matrículas, asistencia, notas, comunicaciones, pagos, documentos, permisos, salud, auditoría, licencias y respaldos. Se prueba localmente antes de publicar cambios y la versión web se despliega en Render con Supabase como infraestructura principal de datos y archivos.

## Capabilities and Constraints

- Autenticación y autorización por roles, con aislamiento entre colegios.
- Paneles y módulos específicos para superadministración, administración escolar, dirección, secretaría, docencia, familias y personal de apoyo.
- Backend existente y lógica funcional deben conservarse durante el rediseño.
- La experiencia web usa Next.js y debe continuar funcionando en escritorio y móvil.
- La interfaz debe tolerar conexiones lentas y estados vacíos, de carga y error sin perder contexto.
- Los colores semánticos de éxito, advertencia y peligro no deben confundirse con la identidad azul.

## Brand Commitments

- Nombre del producto: SIGE, Sistema Integral de Gestión Escolar.
- El azul es la identidad principal y debe alinear la web con la aplicación Flutter.
- El búho azul es el personaje institucional. Debe aparecer con emociones y gestos contextuales, sin distraer de las tareas.
- La experiencia debe sentirse profesional, moderna, estable, cercana y claramente superior a una plantilla genérica.

## Evidence on Hand

- Código web y backend existentes en este repositorio.
- Aplicación Flutter y familia de búhos azules en `C:\Users\CARCE\AndroidStudioProjects\SIGEFlutter`.
- Auditoría visual y funcional de DataCole disponible en el directorio de trabajo de Codex.
- No deben inventarse testimonios, métricas comerciales ni reconocimientos institucionales.

## Product Principles

1. La función y los permisos nunca se sacrifican por el rediseño.
2. Cada rol reconoce una misma plataforma, pero recibe una jerarquía adaptada a su trabajo.
3. El búho orienta y humaniza estados relevantes; no reemplaza contenido ni controles.
4. Los datos importantes son legibles, comparables y accionables.
5. El sistema comunica claramente qué ocurrió y cuál es el siguiente paso.

## Accessibility & Inclusion

La experiencia debe conservar navegación por teclado, foco visible, contraste WCAG AA, objetivos táctiles de al menos 44px y una alternativa reducida para movimientos no esenciales.
