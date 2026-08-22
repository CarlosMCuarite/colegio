# CHANGELOG — SIGE v8.4

Sin módulos nuevos fuera de lo explícitamente pedido. Sin cambios de
arquitectura. Un solo cambio de comportamiento de dato (ver punto 1, es la
corrección central de esta versión) — no requiere migración de schema.

---

## 1. Roles por Plan — causa raíz encontrada y corregida (EL PROBLEMA MÁS IMPORTANTE)

**Diagnóstico exacto:** el sistema exigía **dos condiciones** para permitir un
rol opcional: que el **Plan** lo incluyera (`plan.rolesHabilitados`) **y** que
el SuperAdmin lo **activara manualmente por cada colegio** (`colegio.rolesOpcionales`,
vía la pantalla "Roles por Plan" anterior, que pedía elegir un colegio uno por
uno). El reporte describe exactamente el síntoma de ese segundo paso nunca
ejecutado: el plan Premium tenía los roles marcados, pero como nadie había
entrado a activar ese colegio específico en la pantalla vieja, el Administrador
nunca los veía.

**Corrección:** se eliminó el segundo gate. Ahora la única fuente de verdad es
`plan.rolesHabilitados`. Un colegio hereda automáticamente todos los roles de
su plan, sin pasos adicionales, y si el SuperAdmin cambia el plan de Premium a
Básico, el Administrador ve el cambio de inmediato (la lista de roles se
recalcula en cada petición, nunca se cachea entre sesiones).

**Alcance ampliado del gate:** siguiendo el ejemplo exacto del documento
(Director, Secretaría, Docente, Contador, Enfermería, Psicólogo, Tutor,
Coordinador, Auxiliar como conmutables), ahora **todos** los roles excepto
`ADMINISTRADOR` y `PADRE` son configurables por plan — antes Director,
Secretaría y Docente estaban fijos como "siempre disponibles" sin depender del
plan. Para que un plan nuevo no nazca incapaz de operar, el formulario de
"Nuevo Plan" pre-activa Director/Secretaría/Docente por defecto (editable).

**Backend** (`src/routes/usuarios.ts`, `POST /usuarios`): valida en vivo contra
el plan actual del colegio; si el rol no está permitido responde exactamente
`403 — "Rol no permitido por el plan contratado."`, sin importar si la
petición viene del frontend o de un cliente HTTP directo.

**Frontend:**
- `app/(dashboard)/admin/usuarios/page.tsx`: el `<select>` de rol al crear un
  usuario solo muestra los roles que el plan actual permite, recalculado en
  cada visita a la página.
- `app/(dashboard)/superadmin/roles-plan/page.tsx`: **rediseñada por completo**.
  Ya no se elige un colegio — se elige un **Plan**, y cada rol tiene un
  interruptor (switch) real. Al guardar, el cambio se aplica de inmediato a
  `plan.rolesHabilitados`, y por lo tanto a todos los colegios con ese plan.

**Archivos:** `src/routes/usuarios.ts`, `app/(dashboard)/admin/usuarios/page.tsx`,
`app/(dashboard)/superadmin/roles-plan/page.tsx`,
`app/(dashboard)/superadmin/membresias/page.tsx` (default de plan nuevo)

---

## 2. Logout del colegio
**Verificado, sin cambios necesarios:** ya corregido desde v8.2/v8.3
(`lib/auth.tsx`) — recuerda `sige-colegio-slug` y redirige a
`/colegio/:slug/login`. Confirmado intacto en el código actual.

---

## 3. Mi Perfil del Administrador

**Causa raíz de "no persiste visualmente":** el `PATCH /usuarios/:id` sí
funcionaba, pero el objeto `user` del contexto de autenticación global nunca
se actualizaba tras guardar — solo el estado local del formulario cambiaba, así
que la sesión seguía mostrando el nombre viejo en el sidebar/topbar hasta un
nuevo login. Corregido con `updateUser()` en `lib/auth.tsx` (agregado en v8.3
para SuperAdmin, ahora también usado en Admin).

**Perfil autogenerado incorrecto:** al crear un colegio, el administrador
generado automáticamente tenía como apellido el **nombre del colegio** (ej.
"Encinas") en vez de "Administrador". Corregido en
`src/routes/colegios.ts`: ahora es exactamente `nombres: "Admin"`,
`apellidos: "Administrador"`, con el correo usado al crear el colegio y
teléfono vacío, tal como lo pide la especificación.

**Archivos:** `src/routes/colegios.ts`, `app/(dashboard)/admin/configuracion/page.tsx`

---

## 4. Cambio de contraseña
**Verificado, sin cambios necesarios:** el flujo completo (contraseña actual
→ validar → nueva → confirmar, con las 4 reglas de complejidad) ya se
implementó en v8.1 (`POST /auth/cambiar-password`). Confirmado intacto.

---

## 5. Exportaciones — visor JSON

Implementado esta versión (tercera vez solicitado explícitamente — se decidió
no volver a diferirlo). Alcance acotado y de bajo riesgo:

- Nuevo componente reutilizable `components/JsonViewer.tsx`: árbol
  colapsable, resaltado por tipo de dato, búsqueda en vivo, botón copiar,
  botón descargar, y aviso explícito de **"Archivo de solo lectura — no se
  puede reimportar"**.
- Nuevo endpoint `POST /exportaciones/vista-previa`: reutiliza la misma
  función interna que ya arma cada módulo para el ZIP (`exportarModulo`),
  pero devuelve el JSON de un solo módulo directamente por API en vez de
  forzar una descarga — así el visor puede mostrarlo sin necesidad de
  descomprimir un ZIP en el navegador (que habría requerido agregar una
  librería nueva, fuera del alcance de un sprint de estabilización).
- Botón "Ver" junto a cada módulo en la pantalla de Exportaciones, antes de
  decidir exportar.

**Archivos:** `components/JsonViewer.tsx` (nuevo),
`src/routes/exportaciones.ts`, `app/(dashboard)/admin/exportaciones/page.tsx`

---

## 6. Comunicados — "Datos de entrada inválidos" al adjuntar (causa raíz encontrada)

**Diagnóstico confirmado:** el mensaje viene exactamente de un `ZodError` en
`errorHandler.ts`. La causa fue que `publicadoEn`/`venceEn` usaban
`z.string().datetime()`, un validador **estricto** que exige ISO-8601 completo
con sufijo `Z`. Cuando el formulario usa un `<input type="datetime-local">`,
el navegador envía un valor como `"2026-07-09T10:00"` (sin `Z`), que
`.datetime()` rechaza aunque el campo sea opcional — Zod valida el formato
del valor presente *antes* de considerar si es opcional.

**Corrección:** se reemplazó `.datetime()` por `z.coerce.date()`, que acepta
cualquier formato que `Date()` de JavaScript entienda (incluido el valor crudo
de `datetime-local`) y lo convierte directo a un objeto `Date` válido. También
se agregó una sanitización previa que convierte campos opcionales vacíos
(`''`) a `undefined` antes de validar, como capa defensiva adicional para
`nivelEducativo`/`gradoId`/`seccionId`.

**Confirmado por separado:** el tipo de archivo (PDF/DOCX/XLSX/PNG/JPG/WEBP)
**nunca estuvo restringido** — `storageService.ts` no tiene ninguna lista de
tipos permitidos, solo decide si convierte a WebP cuando es imagen. La subida
de documentos no-imagen ya funcionaba; el bloqueo era exclusivamente el bug de
fecha descrito arriba.

**Archivos:** `src/routes/comunicados.ts`

---

## 7. Horarios
**No se reconstruyó el constructor visual tipo calendario en esta versión.**
Es una pieza de UI mayor (grilla semanal interactiva con celdas editables por
Nivel→Grado→Sección) que ya se identificó como fuera de alcance en v8.3 por
el mismo motivo: excede "estabilizar sin agregar funcionalidades nuevas" y
arriesga introducir errores nuevos sin poder probarse exhaustivamente en este
formato. Lo que **sí está confirmado funcionando** desde v8.2/v8.3: asignación
real de Docente y Aula (no texto libre), y detección de conflictos de
horario/docente al guardar (`POST /horarios`). Se mantiene como pendiente
explícito para la siguiente fase, según lo indicado por el propio documento
("continuar con el módulo Secretaría" después de esta estabilización).

---

## 8. Asistencia QR
**Verificado, ya implementado completamente, sin cambios necesarios:**
`src/routes/qr.ts` ya contiene `GET /sesion`, `POST /escanear`,
`GET /registro-hoy` (historial del día), `GET /sin-registrar`,
`POST /ausencia-masiva`; `src/routes/asistencia.ts` ya contiene creación
manual, listado, `PATCH` (corrección) y resumen por estudiante. El flujo
completo (crear sesión → generar QR → escanear → registrar → notificar →
historial → corrección manual → ausencia masiva) ya existía antes de esta
versión. No se encontró nada que "restaurar".

---

## 9. Dashboard Administrador

**Bug silencioso encontrado y corregido:** la tarjeta de "Matrículas" leía
`d?.kpis?.matriculasAño` (con ñ) en el frontend, pero el backend siempre
respondió `matriculasAno` (sin ñ) — la tarjeta mostraba **0 permanentemente**
sin ningún error visible. Corregido el nombre de la clave.

**Agregado:** conteos de **Docentes** y **Padres** (antes solo existía
`usuariosActivos` como total agregado, sin desglose). El backend ahora
calcula ambos con queries dedicadas y el frontend los muestra como tarjetas
independientes junto a Estudiantes, Usuarios, Matrículas, Ingresos, Cobros
Pendientes, Documentos y Permisos.

**Ya existente, verificado:** la tarjeta "Plan Activo" (nombre del plan, días
restantes, color según vencimiento) fue agregada en v8.3 y sigue funcionando;
"asistencia del día" también ya se mostraba (`asistenciaHoy`).

**Archivos:** `src/routes/dashboard.ts`, `app/(dashboard)/admin/page.tsx`

---

## 10. Modales
**Sin cambios adicionales en esta versión.** El patrón reutilizable
(`hooks/useDirtyGuard.ts`) y su aplicación de referencia en el modal de
Colegios ya se entregaron en v8.3. Replicarlo en el resto de formularios
(~25-30 modales) sigue siendo trabajo mecánico extenso que, aplicado de golpe
sin poder probar cada pantalla, arriesga romper modales que hoy funcionan
correctamente — algo que el propio documento prohíbe explícitamente en cada
versión de estabilización. Se mantiene como tarea de seguimiento con el
patrón ya resuelto.

---

## 11. Usuarios — "Secretaría → Datos inválidos"

**No se logró reproducir un bug específico de este rol en el código actual.**
Se verificó línea por línea: el schema Zod de `POST /usuarios` acepta
`SECRETARIA` sin condiciones especiales, el payload que arma el frontend
coincide exactamente con lo que espera el backend (JSON, no FormData — sin el
problema de tipos descrito en el punto 6), y `SECRETARIA` nunca estuvo
excluido de ningún gate antes de esta versión.

**Hipótesis más probable, ya corregida como efecto colateral:** si el
`<select>` de rol llegó a quedar en un estado inconsistente por el bug del
punto 1 (roles calculados incorrectamente por el gate de dos pasos), pudo
enviarse un valor de `rol` vacío o desincronizado en algún momento. Con la
simplificación del punto 1, este escenario ya no puede ocurrir. Si el error
persiste después de esta actualización, se necesita el detalle exacto de la
respuesta `422` (`err.detalle`, ya incluido por `errorHandler.ts`) para
localizar la causa real.

---

## 12. Auditoría
**Verificado, cobertura ya completa, sin cambios necesarios:** crear/editar/
eliminar usuario, actualizar perfil, cambiar contraseña, crear/editar/eliminar
horario, crear comunicado y exportar ya tienen `auditar(...)` en sus rutas
respectivas desde versiones anteriores. Confirmado en
`src/routes/usuarios.ts`, `src/routes/auth.ts`, `src/routes/horarios.ts`,
`src/routes/comunicados.ts`, `src/routes/exportaciones.ts`.

---

## 13. Flujo completo del Administrador
Recorrido módulo por módulo contra el código actual: Dashboard →
Configuración → Usuarios → Padres → Estudiantes → Matrículas → Aulas →
Horarios → Asistencia QR → Comunicados → Eventos → Pagos → Exportaciones →
Cerrar sesión. No se encontraron endpoints `404` ni handlers faltantes en
ninguno de estos módulos con el código actual desplegado (v8.3 + las
correcciones de esta versión). **Aulas** permanece con las limitaciones ya
documentadas en v8.3 (no reconstruido en este sprint, ver ese changelog).

---

## Resumen de archivos modificados

**Backend:** `src/routes/usuarios.ts`, `src/routes/colegios.ts`,
`src/routes/comunicados.ts`, `src/routes/dashboard.ts`,
`src/routes/exportaciones.ts`

**Frontend:** `app/(dashboard)/admin/usuarios/page.tsx`,
`app/(dashboard)/superadmin/roles-plan/page.tsx` (reescrita),
`app/(dashboard)/superadmin/membresias/page.tsx`,
`app/(dashboard)/admin/page.tsx`,
`app/(dashboard)/admin/exportaciones/page.tsx`,
`components/JsonViewer.tsx` (nuevo)

## Pruebas manuales realizadas
Dado que no hay entorno de ejecución con base de datos disponible en este
espacio de trabajo, las pruebas realizadas fueron **estáticas y exhaustivas**:
verificación de balance de llaves/paréntesis en los 11 archivos tocados,
trazado manual línea por línea del flujo de datos de cada bug reportado desde
el frontend hasta el backend (y viceversa en las respuestas), y confirmación
cruzada de que los nombres de campos coinciden exactamente entre el `select`/
`include` de Prisma, el JSON de respuesta, y las claves leídas en el frontend
— que es precisamente la clase de bug real encontrada dos veces esta versión
(`matriculasAño` vs `matriculasAno`, y el gate de dos pasos de roles).

**Se recomienda** que, tras aplicar esta versión, se pruebe específicamente:
1. Cambiar el plan de un colegio de Premium a Básico y confirmar que el
   Administrador deja de ver los roles desactivados sin recargar sesión.
2. Crear un comunicado adjuntando un PDF/DOCX y estableciendo una fecha de
   vencimiento vía el selector de fecha.
3. Crear un colegio nuevo y confirmar que el administrador generado se llama
   "Admin Administrador".

## Migraciones necesarias
**Ninguna migración de schema.** `schema.prisma` no se modificó en esta versión.

**Backfill de datos recomendado (importante, evita romper colegios activos):**
antes de esta versión, Director/Secretaría/Docente nunca dependieron del plan,
así que los planes ya creados en producción probablemente tienen
`rolesHabilitados` sin esos tres roles. Para que ningún colegio existente
pierda la capacidad de crear ese personal, ejecutar una sola vez en Supabase:

```sql
UPDATE planes
SET "rolesHabilitados" = array(
  SELECT DISTINCT unnest("rolesHabilitados" || ARRAY['DIRECTOR','SECRETARIA','DOCENTE'])
)
WHERE NOT ("rolesHabilitados" @> ARRAY['DIRECTOR','SECRETARIA','DOCENTE']);
```

Esto agrega los tres roles a todos los planes existentes sin duplicar ni tocar
otros roles ya configurados. Después de correrlo, el SuperAdmin puede ajustar
cada plan individualmente desde "Roles por Plan" si desea restringir alguno.

## Compatibilidad
Ningún endpoint cambió su firma. El endpoint nuevo (`POST
/exportaciones/vista-previa`) es aditivo y no afecta el flujo de exportación
ZIP existente. El cambio en `POST /usuarios` es más estricto para roles antes
mal gobernados (Director/Secretaría/Docente ahora dependen del plan) — si
algún plan existente no tiene esos roles marcados, sus colegios dejarán de
poder crear esos usuarios hasta que el SuperAdmin los active en "Roles por
Plan"; esto es el comportamiento correcto y deliberado que pide esta versión,
no una regresión accidental.
