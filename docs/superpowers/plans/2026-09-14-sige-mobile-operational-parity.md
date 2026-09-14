# SIGE Mobile Operational Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar una app Flutter versionada, actualizable desde Superadmin y funcionalmente alineada con la web, corrigiendo primero Storage, backups y contratos de archivos.

**Architecture:** Express/Prisma seguirá siendo la única fuente de reglas y permisos. La web administrará publicaciones APK y diagnósticos; Flutter consumirá los mismos contratos tipados, resolverá tema/fechas/archivos de forma centralizada y nunca mostrará IDs internos. El trabajo se entrega en fases independientes con pruebas de regresión y verificación física en Xiaomi.

**Tech Stack:** TypeScript, Express, Prisma, Supabase Storage/PostgreSQL, Next.js 14, Flutter/Dart, GitHub Actions, Jest/Node Test, Flutter Test.

**Spec:** `docs/superpowers/specs/2026-09-14-sige-mobile-operational-parity-design.md`

## Global Constraints

- El login móvil existente no se modifica.
- El crédito visible debe ser exactamente `Desarrollado por CARCE`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca se expone en web, Flutter, GitHub Actions ni respuestas HTTP.
- Los APK y documentos privados se entregan mediante URLs firmadas de corta duración.
- Las fechas escolares se representan como `dd/MM/yyyy` y no muestran hora salvo que el evento la requiera.
- Cada cambio de producción nace de una prueba que falla, luego pasa y finalmente se refactoriza.
- Los artefactos `.impeccable/review/*` y el cambio local pendiente en `sige/src/routes/tesis.ts` quedan fuera de estos commits.

---

### Task 1: Incorporar y sanear el proyecto Flutter

**Files:**
- Create: `sige-mobile/**` desde `C:/Users/CARCE/AndroidStudioProjects/SIGEFlutter`
- Modify: `sige-mobile/.gitignore`
- Create: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Consumes: proyecto Flutter local `version: 1.0.0+1`.
- Produces: aplicación reproducible desde `sige-mobile/` y registro de avance auditable.

- [ ] Copiar código, assets, Android y pruebas, excluyendo `.dart_tool`, `.idea`, `build`, `artifacts`, archivos de preview y credenciales.
- [ ] Ejecutar `flutter pub get` y `flutter analyze`; registrar fallos preexistentes sin ocultarlos.
- [ ] Ejecutar `flutter test` y construir APK debug para demostrar que la importación no cambió comportamiento.
- [ ] Actualizar `docs/IMPLEMENTATION_PROGRESS.md` con comandos y resultados.
- [ ] Commit: `Incorporar aplicación Flutter al repositorio`.

### Task 2: Diagnóstico y normalización de Storage

**Files:**
- Create: `sige/src/utils/storagePath.ts`
- Create: `sige/src/__tests__/storagePath.test.ts`
- Modify: `sige/src/services/storageService.ts`
- Modify: `sige/src/routes/documentos.ts`
- Modify: `sige/src/routes/comunicados.ts`
- Modify: `sige/src/routes/eventos.ts`
- Modify: `sige/src/routes/pagos.ts`
- Modify: `sige/src/routes/pagosLicencia.ts`
- Modify: `sige/src/routes/backups.ts`

**Interfaces:**
- Produces: `normalizeStoragePath(value: string, bucket: string): string` y `signStoredFile(bucket, value, expiresIn): Promise<string>`.

- [ ] Escribir pruebas que reproduzcan URL completa, URL firmada, `bucket/path`, prefijo duplicado, path válido y objeto inexistente.
- [ ] Ejecutar las pruebas y confirmar que fallan porque el normalizador no existe.
- [ ] Implementar el normalizador puro y centralizar firma/errores en `storageService`.
- [ ] Reemplazar resoluciones particulares de vouchers, comunicados, eventos, documentos y backups.
- [ ] Añadir prueba de integración por bucket: subir temporal, firmar, descargar y borrar.
- [ ] Verificar que un archivo inexistente devuelve `404` accionable y no un `403` engañoso.
- [ ] Commit: `Normalizar rutas y diagnóstico de archivos en Storage`.

### Task 3: Reparar y hacer observable el backup automático

**Files:**
- Create: `sige/src/__tests__/backupService.test.ts`
- Modify: `sige/src/services/backupService.ts`
- Modify: `sige/src/routes/backups.ts`
- Modify: `sige-frontend/app/(dashboard)/superadmin/backups/page.tsx`

**Interfaces:**
- Produces: resultado con `estado`, `tablas`, `archivosIncluidos`, `archivosOmitidos`, `tamanoBytes`, `iniciadoEn`, `finalizadoEn` y error seguro.

- [ ] Probar fallo por bucket ausente, archivo fuente ausente, clave inválida y backup íntegro.
- [ ] Confirmar RED y luego implementar estados persistentes sin borrar historial durante el refresco.
- [ ] Separar “sin cambios” de “fallido” y conservar el último backup recuperable.
- [ ] Mostrar detalle técnico saneado y botón de diagnóstico por bucket en Superadmin.
- [ ] Ejecutar manualmente un backup y verificar descarga e integridad.
- [ ] Commit: `Hacer verificables los respaldos automáticos`.

### Task 4: Health check diario de PostgreSQL

**Files:**
- Create: `sige/src/routes/health.ts`
- Create: `sige/src/__tests__/health.test.ts`
- Modify: `sige/src/index.ts`
- Create: `.github/workflows/database-keepalive.yml`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Produces: `GET /api/v1/health/database` protegido por `X-Health-Token`, respuesta `{ok, database, checkedAt}`.

- [ ] Probar rechazo sin token, rechazo con token incorrecto y `200` con consulta real.
- [ ] Implementar comparación constante del secreto, rate limiting y `SELECT 1` mediante Prisma.
- [ ] Crear workflow diario a las 13:17 UTC usando secretos `SIGE_HEALTH_URL` y `SIGE_HEALTH_TOKEN`.
- [ ] Ejecutar workflow manual y verificar actividad en Supabase/Render.
- [ ] Commit: `Agregar verificación diaria de PostgreSQL`.

### Task 5: Publicaciones privadas de APK en Superadmin

**Files:**
- Modify: `sige/prisma/schema.prisma`
- Create: `sige/docs/ACTUALIZACIONES_MOVILES.sql`
- Create: `sige/src/routes/actualizaciones.ts`
- Create: `sige/src/services/mobileReleaseService.ts`
- Create: `sige/src/__tests__/mobileReleaseService.test.ts`
- Modify: `sige/src/index.ts`
- Modify: `sige-frontend/components/layout/Sidebar.tsx`
- Create: `sige-frontend/app/(dashboard)/superadmin/actualizaciones/page.tsx`

**Interfaces:**
- Produces: comparación semántica, publicación transaccional, `GET /actualizaciones/actual`, carga administrativa y URL firmada.

- [ ] Probar versiones menor/igual/mayor, build superior, APK con MIME falso, hash y activación única.
- [ ] Crear modelo aditivo y migración idempotente; aplicar y validar sin borrar datos.
- [ ] Implementar carga privada, SHA-256, publicación opcional/obligatoria y desactivación anterior.
- [ ] Construir pantalla Superadmin accesible para subir, activar, descargar y revisar historial.
- [ ] Compilar backend/frontend y probar un APK de ensayo.
- [ ] Commit: `Administrar actualizaciones privadas de Android`.

### Task 6: Cliente actualizador e información de Flutter

**Files:**
- Modify: `sige-mobile/pubspec.yaml`
- Create: `sige-mobile/lib/core/update/app_update_service.dart`
- Create: `sige-mobile/lib/core/update/app_update_dialog.dart`
- Create: `sige-mobile/test/core/update/app_update_service_test.dart`
- Modify: archivo de arranque existente bajo `sige-mobile/lib/`
- Modify: pantalla de información/perfil existente.

**Interfaces:**
- Consumes: `GET /actualizaciones/actual`.
- Produces: `UpdateDecision.none|optional|required`, descarga verificada por SHA-256 e instalador Android.

- [ ] Probar decisión de versión, actualización obligatoria, error offline y hash incorrecto.
- [ ] Implementar consulta no bloqueante después del splash sin modificar el login.
- [ ] Implementar diálogo accesible, progreso, reintento y bloqueo solo para versión obligatoria.
- [ ] Mostrar versión/build y `Desarrollado por CARCE`.
- [ ] Instalar APK en Xiaomi y validar actualización desde una versión anterior.
- [ ] Commit: `Agregar actualizador privado e información de la aplicación`.

### Task 7: Fichas de colegios, estudiantes y matrículas

**Files:**
- Modify: endpoints/selects pertinentes en `sige/src/routes/colegios.ts`, `estudiantes.ts`, `matriculas.ts`.
- Modify/Create: modelos y pantallas correspondientes bajo `sige-mobile/lib/features/`.
- Test: rutas backend y widgets de detalle/edición Flutter.

**Interfaces:**
- Produces: DTOs de presentación con nombres y relaciones, sin obligar al cliente a mostrar IDs.

- [ ] Probar logo en listado de colegios y permisos de foto/carné por rol.
- [ ] Probar fecha sin hora, estado editable, año de ingreso y ficha de matrícula legible.
- [ ] Implementar DTOs y pantallas con acciones Ver foto, Cambiar foto, Ver carné y Generar carné.
- [ ] Corregir edición web/móvil para que compartan estado y año de ingreso.
- [ ] Verificar en Xiaomi con Administrador y Secretaría.
- [ ] Commit: `Completar fichas de colegios estudiantes y matrículas`.

### Task 8: Horarios, cursos y pagos móviles

**Files:**
- Modify: repositorios/pantallas bajo `sige-mobile/lib/features/` para horarios, cursos y pagos.
- Modify: rutas backend solo si las pruebas demuestran contratos incompletos.
- Test: widgets de tabla semanal, CRUD cursos y filtros pagos.

**Interfaces:**
- Produces: horario semanal por grado/sección, cursos con CRUD y pagos filtrables con voucher.

- [ ] Reproducir cursos vacíos y escribir prueba del parseo de la respuesta real.
- [ ] Implementar tabla semanal responsive con selector de día accesible en ancho reducido.
- [ ] Implementar CRUD/selección de cursos respetando permisos.
- [ ] Implementar filtros de pagos por texto, estado, fecha y grado; añadir detalle/voucher.
- [ ] Verificar web y Xiaomi con datos reales.
- [ ] Commit: `Completar horarios cursos y pagos en Flutter`.

### Task 9: Comunicados, eventos y documentos

**Files:**
- Modify: `sige/src/routes/comunicados.ts`, `eventos.ts`, `documentos.ts`.
- Modify: páginas web compartidas relacionadas.
- Modify: módulos Flutter correspondientes.
- Test: fechas locales, validación española, adjuntos y selección de calendario.

**Interfaces:**
- Produces: mensajes de validación en español, `LocalDate` escolar estable y adjuntos uniformes.

- [ ] Probar contenido menor a cinco caracteres y esperar mensaje español asociado a Contenido.
- [ ] Probar que `2026-09-16` se muestra como 16 tanto en web como en Lima/Android.
- [ ] Implementar programación/lectura/adjuntos para todos los roles destinatarios.
- [ ] Implementar calendario seleccionable con detalle, anteriores/próximos y documentos.
- [ ] Implementar gestión documental con upload, filtros, estados, vista y descarga.
- [ ] Verificar cada tipo de archivo nuevo contra Supabase.
- [ ] Commit: `Unificar comunicados eventos y documentos`.

### Task 10: Solicitudes, encuestas y dashboard por rol

**Files:**
- Create/Modify: rutas y modelo de solicitudes si no existe uno reutilizable.
- Modify: módulos Flutter de reportes, encuestas, home, navegación y tema.
- Test: permisos por rol, navegación y golden/widget tests de 360/412 px.

**Interfaces:**
- Produces: solicitudes padre→colegio, encuestas funcionales y home adaptado por rol/color.

- [ ] Probar creación/seguimiento por Padre y gestión por Secretaría/Director/Administrador.
- [ ] Restaurar encuestas con listado, respuesta y resultados autorizados.
- [ ] Centralizar tokens pastel desde el color del colegio y eliminar azules fijos.
- [ ] Rediseñar accesos por rol, drawer y bottom navigation con máximo cinco destinos.
- [ ] Ejecutar análisis, tests, APK y recorrido completo en Xiaomi.
- [ ] Commit: `Completar solicitudes encuestas y paneles móviles por rol`.

### Task 11: Validación final y despliegue

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: documentación operativa de secretos y publicación.

**Interfaces:**
- Produces: evidencia reproducible de producción y APK candidato.

- [ ] Ejecutar suites backend, frontend y Flutter sin errores.
- [ ] Ejecutar migraciones aditivas y configurar secretos de Render/GitHub.
- [ ] Probar Storage, backup automático, health check y actualización desde producción.
- [ ] Instalar APK candidato en Xiaomi y capturar cada dashboard por rol.
- [ ] Actualizar el Markdown con resultados, limitaciones y pasos de publicación.
- [ ] Commit: `Documentar validación integral de SIGE`.

