# SIGE: paridad operativa móvil, actualizaciones privadas y continuidad

## Objetivo

Dejar la aplicación Flutter alineada con el sistema web, corregir los flujos bloqueados por Storage, ofrecer actualizaciones privadas administradas por Superadmin y asegurar que los paneles respeten el colegio, rol y color configurados. El login existente no se modifica.

## Alcance y orden de ejecución

El trabajo se divide en fases porque Storage, archivos y contratos API son dependencias de casi todos los módulos móviles. Cada fase debe compilar y contar con pruebas antes de iniciar la siguiente.

### Fase 1: continuidad y diagnóstico de infraestructura

- Corregir la causa real de los `403` en los buckets `documentos`, `vouchers`, `backups`, `avatares` y `logos`.
- Añadir diagnóstico autenticado de Storage que compruebe listado, escritura, lectura y borrado temporal por bucket sin exponer secretos.
- Normalizar las rutas persistidas: guardar siempre `bucket/path`, nunca URL firmada ni URL pública temporal.
- Recuperar de forma compatible registros antiguos que contengan URL completa o prefijos duplicados.
- Registrar en cada backup automático su inicio, final, cantidad de registros, archivos incluidos, omitidos y error técnico.
- Añadir un health check de base de datos que ejecute una consulta mínima (`SELECT 1`) y no escriba información empresarial.
- Crear un workflow diario de GitHub Actions que invoque ese health check. El endpoint tendrá un token específico guardado como secreto y rate limiting. El ping evita inactividad, pero no se presentará como solución a errores `403`.

### Fase 2: actualizador privado de Android

- Incorporar el proyecto Flutter actual como `sige-mobile/`, excluyendo `build`, `.dart_tool`, `.idea`, artefactos locales y secretos.
- Crear un modelo de versión móvil con: versión semántica, build number, plataforma, APK, hash SHA-256, tamaño, notas, fecha, estado, versión mínima y bandera obligatoria.
- Crear en Superadmin una pantalla de publicaciones móviles con carga del APK firmado, validación MIME/contenido, activación, desactivación y descarga.
- La aplicación consultará la versión activa después del arranque, comparará `version + buildNumber` y mostrará actualización opcional u obligatoria.
- La descarga verificará SHA-256 antes de abrir el instalador de Android. Android pedirá confirmación de instalación; SIGE no intentará una instalación silenciosa.
- La pantalla de información mostrará versión/build y el crédito exacto `Desarrollado por CARCE`.
- Los APK se almacenarán en un bucket privado específico y se descargarán mediante URL firmada de corta duración.

### Fase 3: contratos de archivos compartidos

- Aplicar un único resolvedor de archivos para vouchers, comunicados, eventos, documentos y actualizaciones.
- Traducir validaciones técnicas de Zod a mensajes en español asociados al campo correspondiente.
- Permitir adjuntos en gestión documental, comunicados y eventos según permisos del rol.
- Mostrar nombre, tipo, tamaño, vista previa y acción de descarga.
- Probar archivos nuevos y registros heredados con rutas antiguas o archivos ausentes.

### Fase 4: paridad de gestión académica

- **Colegios Superadmin:** mostrar logo en cada tarjeta/listado sin tener que abrir el detalle.
- **Estudiantes:** ficha legible sin IDs técnicos; foto, estado, año de ingreso, fecha `dd/MM/yyyy`, acciones para ver/cambiar foto y ver/generar carné según rol.
- **Matrículas:** ficha legible con estudiante, grado, sección, año, estado, precio y acciones permitidas; edición móvil y web coherentes.
- **Horarios:** tabla semanal responsive en móvil, con selector de grado/sección y alternativa accesible por día para pantallas angostas; no una lista plana.
- **Cursos:** corregir carga vacía, CRUD y selección masiva según permisos de Administrador y Secretaría.
- **Pagos:** búsqueda y filtros por fecha/estado/grado/estudiante, resumen, detalle de conciliación y visualización del voucher.

### Fase 5: comunicación y experiencia por rol

- **Comunicados:** programación, vencimiento, adjuntos y lectura para todos los roles destinatarios.
- **Eventos:** corregir desfase de un día usando fechas escolares sin conversión UTC accidental; calendario seleccionable, detalle diario, anteriores/próximos y adjuntos.
- **Documentos:** gestión con archivos adjuntos y estados; listado móvil con filtros y acciones reales.
- **Reportes/solicitudes:** sustituir la pantalla rota por solicitudes creadas por padres, visibles y gestionables por Secretaría, Director y Administrador.
- **Encuestas:** habilitar navegación, listado, respuesta y resultados según rol.

### Fase 6: diseño móvil coherente

- Mantener el login intacto.
- Usar tokens derivados del color del colegio; eliminar azul fijo en iconos, mascota, tarjetas y estados neutros.
- Dar identidad propia a cada rol mediante contenido, jerarquía y accesos, sin crear sistemas visuales incompatibles.
- Limitar la navegación inferior a las áreas prioritarias y dejar el resto en drawer/sidebar.
- Evitar tarjetas cortadas horizontalmente; diseñar desde 360 px, respetar áreas seguras y objetivos táctiles mínimos de 44 px.
- Añadir estados de carga, vacío, error y reintento específicos para cada módulo.

## Arquitectura

### Backend

- Express y Prisma continúan como fuente única de reglas y permisos.
- Un servicio `storagePathService` normalizará y resolverá referencias de archivos.
- Un servicio `mobileReleaseService` validará versiones, hash, APK y publicación activa.
- Los endpoints móviles reutilizarán los existentes cuando el contrato ya sea suficiente; no se duplicará lógica por plataforma.
- Los permisos se validarán en backend, no únicamente ocultando botones.

### Web Superadmin

- Nuevo módulo `Actualizaciones` para administrar versiones.
- Diagnóstico de Storage y backups con mensajes accionables, sin mostrar claves.
- Las pantallas existentes conservarán sus rutas y componentes compartidos.

### Flutter

- Repositorios tipados por dominio en lugar de mostrar mapas JSON crudos.
- Modelos de presentación ocultarán IDs internos y formatearán fechas localmente.
- Servicios comunes para archivos, actualización, tema escolar y errores.
- Caché solo para datos de lectura; las mutaciones invalidarán los recursos relacionados.

## Modelo de actualización

Una publicación contiene como mínimo:

- `id`, `plataforma`, `version`, `buildNumber`;
- `storagePath`, `sha256`, `tamanoBytes`;
- `notasVersion`, `obligatoria`, `versionMinima`;
- `activa`, `publicadaEn`, `creadaPorId`, `createdAt`, `updatedAt`.

Solo puede existir una publicación activa por plataforma. Activar una nueva versión desactiva la anterior dentro de una transacción.

## Seguridad

- Nunca incluir `SUPABASE_SERVICE_ROLE_KEY` en frontend, Flutter, GitHub o respuestas API.
- Los uploads administrativos requieren Superadmin y validación de contenido real del APK.
- El endpoint de actualización devuelve metadatos y una URL firmada; no hace público el bucket.
- El health check externo usa un secreto independiente y rotatorio, con respuesta mínima.
- Los adjuntos respetan colegio y rol antes de firmar la descarga.

## Pruebas y aceptación

- Pruebas unitarias para normalización de rutas, comparación de versiones, fechas escolares y traducción de validaciones.
- Pruebas de integración para upload/download por bucket, backup automático y publicación de APK.
- Pruebas de widgets Flutter para fichas, calendario, horario y actualización obligatoria/opcional.
- Compilación de backend, frontend y APK en cada fase.
- Verificación en Xiaomi: captura antes/después y recorrido con Superadmin, Administrador y Secretaría.
- No se considera resuelto Storage hasta subir, abrir y descargar un archivo nuevo de comunicado, evento, documento y voucher.
- No se considera resuelto backup hasta que una ejecución automática termine `COMPLETADO` y su archivo supere la verificación de integridad.

## Despliegue

- Las migraciones serán aditivas y reversibles; no se borrarán datos existentes.
- Cada fase tendrá un commit descriptivo independiente.
- Los secretos se configurarán en Supabase/Render/GitHub, nunca en el repositorio.
- La app incrementará `version` y `buildNumber` en cada APK distribuido.
