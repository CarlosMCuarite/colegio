# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

- Superadministrador: configura colegios, identidad institucional, licencias y operación global.
- Director: supervisa indicadores académicos, financieros y de gestión para tomar decisiones.
- Secretaría: ejecuta la operación diaria del colegio con alta frecuencia y necesita accesos rápidos.
- Otros roles escolares y familias consumen funciones limitadas según sus permisos.

## Product Purpose

SIGE centraliza la gestión multicolegio en web y Android. El aplicativo debe reflejar las mismas reglas, datos y permisos del sistema web, con experiencias móviles adaptadas a cada rol.

## Positioning

Una sola plataforma mantiene sincronizados identidad, permisos, operación y datos del colegio; Super Admin define la identidad y cada rol recibe únicamente las funciones que le corresponden.

## Operating Context

Uso táctil en teléfonos Android, principalmente en orientación vertical y durante la jornada escolar. Dirección consulta información; Secretaría realiza operaciones repetitivas y necesita navegación rápida. La conexión puede ser intermitente y Render puede tardar en despertar.

## Capabilities and Constraints

- Flutter con Riverpod, Dio y GoRouter/Material navigation.
- Backend de producción compartido con el sitio web.
- El color y la identidad del colegio son administrados exclusivamente por Super Admin.
- El login existente está aprobado y no debe rediseñarse.
- La primera pantalla no debe mostrar un tema azul provisional antes de conocer el tema institucional.
- Los datos almacenados en caché nunca deben autorizar acciones ni sustituir reglas del servidor.

## Brand Commitments

- Nombre SIGE.
- Mascota búho con variantes azul, verde, roja y amarilla.
- Logo y nombre reales del colegio.
- Tema institucional azul, verde, rojo o amarillo definido por Super Admin.

## Evidence on Hand

- Activos de mascota e identidad en `assets/images/`.
- Implementación web vigente como referencia funcional.
- Login móvil existente aprobado por el usuario.

## Product Principles

- La configuración central gana sobre preferencias locales.
- Cada rol ve primero sus tareas reales, no un dashboard genérico.
- La aplicación abre con información útil aun cuando la red sea lenta.
- El estado visual nunca debe contradecir el estado real del servidor.
- Las acciones frecuentes deben estar a uno o dos toques.

## Accessibility & Inclusion

Controles táctiles de al menos 48 dp, texto escalable, contraste legible, semántica para lectores de pantalla y respeto a animaciones reducidas.
