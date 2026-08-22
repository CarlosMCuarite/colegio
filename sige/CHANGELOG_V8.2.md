# CHANGELOG — SIGE v8.2 (Estabilización)

Versión enfocada 100% en corrección de errores. No se agregaron funcionalidades nuevas;
los únicos cambios de esquema son aditivos (no rompen datos existentes).

---

## 1. Storage — RLS

**Problema:** `new row violates row-level security policy` al subir imágenes.

**Causa raíz:** el servicio ya usaba `supabaseAdmin` (service_role, que bypasea RLS),
por lo que el error real ocurre cuando los **buckets no existen** o el
`SUPABASE_SERVICE_ROLE_KEY` en `.env` no es el correcto (se usó la `anon key` por error).

**Corrección:**
- `storageService.ts`: mensajes de error específicos que identifican la causa exacta
  (falta bucket / falta policy / service key incorrecta) en vez de un error genérico.
- Nueva función `verificarBuckets()` para diagnóstico.
- Nuevo endpoint `POST /estudiantes/:id/foto` (avatar de estudiante — faltaba).
- Confirmado: comunicados ya soportaba adjuntos de imagen (`POST /comunicados` con `adjunto`).
- Recordatorio: ejecutar `docs/SUPABASE_STORAGE_SETUP.sql` en el SQL Editor de Supabase
  para crear los 4 buckets (`logos`, `avatares`, `documentos`, `vouchers`) y sus policies.

**Archivos:** `src/services/storageService.ts`, `src/routes/estudiantes.ts`

---

## 2. Horarios

**Problemas encontrados:**
- El botón "Limpiar horario" llamaba a `DELETE /horarios/:nivelGradoId/bulk`, endpoint
  que **no existía** en el backend → fallaba silenciosamente.
- No permitía asignar un docente ni aula reales (solo texto libre `docenteNombre`).
- No validaba solapamiento de horarios ni choques de docente.

**Corrección:**
- Nuevo endpoint real `DELETE /horarios/grado/:nivelGradoId` (con `?seccionId=` opcional).
- Nuevos campos `aulaId` y `docenteId` (relaciones reales) en el modelo `Horario`,
  manteniendo `docenteNombre` como fallback de compatibilidad.
- Nuevos endpoints `GET /horarios/docentes-disponibles` y `GET /horarios/aulas-disponibles`.
- Validación de solapamiento: mismo grado/sección/día no puede tener horas cruzadas.
- Validación de choque de docente: un docente no puede estar en dos secciones a la misma hora.
- Frontend: formulario con `<select>` reales de Docente y Aula en vez de texto libre.
- Frontend: botón "Limpiar horario" ahora llama al endpoint correcto y maneja errores.

**Archivos:** `prisma/schema.prisma`, `src/routes/horarios.ts`,
`app/(dashboard)/admin/horarios/page.tsx`

---

## 3. Logout — redirección incorrecta

**Problema:** el logout (y cualquier expiración de sesión / 401) siempre redirigía a
`/auth/login` (login global), aun para usuarios de un colegio específico.

**Corrección:**
- Al hacer login se guarda `sige-colegio-slug` en `localStorage`.
- `logout()` en `auth.tsx` redirige a `/colegio/:slug/login` si existe slug guardado;
  solo cae a `/auth/login` para SuperAdmin (sin colegio).
- Mismo criterio aplicado al interceptor 401 de `api.ts` y al guard de `DashboardLayout.tsx`.

**Archivos:** `lib/auth.tsx`, `lib/api.ts`, `components/layout/DashboardLayout.tsx`

---

## 4. Dashboard Padre

**Verificado:** el endpoint `GET /dashboard/padre` ya estaba construido correctamente
a partir del padre → estudiantes vinculados → asistencia/pagos/observaciones/horarios
derivados de esos estudiantes (sin queries independientes sueltas).

**Corrección aplicada:** el listado de estudiantes ahora solo incluye vínculos con
`estado = APROBADO` (ver punto 6), para que un hijo con solicitud pendiente no aparezca
todavía en el panel del padre.

**Archivos:** `src/routes/dashboard.ts`

---

## 5. Matrículas

**Verificado:** el endpoint de creación de estudiantes (`POST /estudiantes`) **nunca**
aceptó `nivelGradoId`/`seccionId` directamente — ya obligaba a crear la matrícula como
paso separado (`POST /matriculas`). El formulario del frontend tampoco expone esos
campos al crear un estudiante. No se requirió corrección; se documenta como verificado.

---

## 6. Padres — vínculo por DNI con aprobación

**Problema:** solo existía vínculo directo hecho por staff (`vincular-estudiante`);
no existía el flujo de autoservicio "padre solicita → admin aprueba".

**Corrección:**
- Nuevo campo `estado` (`PENDIENTE`/`APROBADO`/`RECHAZADO`) y `aprobadoPorId`
  en `PadreEstudiante` (default `APROBADO` para no romper vínculos existentes).
- Nuevo endpoint `POST /padres/solicitar-vinculo` (el padre ingresa el DNI del estudiante).
- Nuevos endpoints `GET /padres/solicitudes/pendientes`,
  `PATCH /padres/solicitudes/:id/aprobar`, `PATCH /padres/solicitudes/:id/rechazar`.
- El vínculo directo de staff (`vincular-estudiante`) ahora marca explícitamente
  `estado: APROBADO` y registra quién lo aprobó.
- Dashboard del padre y `mi-perfil` solo muestran estudiantes con vínculo `APROBADO`.
- Frontend: panel de "Solicitudes pendientes" en `secretaria/padres`, y botón
  "Vincular hijo" (con DNI) en el dashboard del padre.

**Archivos:** `prisma/schema.prisma`, `src/routes/padres.ts`, `src/routes/dashboard.ts`,
`app/(dashboard)/secretaria/padres/page.tsx`, `app/(dashboard)/padre/page.tsx`

---

## 7. Dashboard Admin

**Verificado:** todas las consultas de `GET /dashboard/ejecutivo` ya usan
`WHERE colegioId = req.colegioId` (resuelto por el middleware `resolveTenant`).
No se encontraron consultas globales sueltas. Sin cambios necesarios.

---

## 8. SuperAdmin — 404 / 500 / Prisma Validation

Revisado contra las correcciones ya aplicadas en v8.1 (perfil precargado vía `/auth/me`,
cambio de contraseña con verificación de actual, licencias recalculando desde hoy,
`generarUsuarios` extraído del body antes de llegar a Prisma). No se encontraron
regresiones adicionales en esta pasada; los endpoints de Configuración, Licencias,
Roles por Plan, Crear Colegio, Planes, Dashboard y Auditoría siguen la misma
implementación validada en v8.1.

---

## 9. Planes — dinámicos

**Verificado:** no quedan enums fijos de tipo de plan (`PlanTipo` fue eliminado en v8.0).
El modelo `Plan` permite nombre libre, módulos y roles configurables por el SuperAdmin
desde la interfaz, sin tocar código.

---

## 10. Flujos

Flujo SuperAdmin → Plan → Colegio → Licencia → Administrador → ... verificado contra
el backend existente; documentado en detalle en `docs/FLUJOS_SIGE.md` (generado en v8.1).

---

## 11. Limpieza de código

- Eliminado el llamado roto a `DELETE /horarios/:id/bulk` (endpoint inexistente).
- Confirmado que no quedan referencias a `plan.tipo` / `PlanTipo` en frontend o backend.
- Revisados los `.catch(() => {})` del frontend: el único restante es la limpieza
  legítima del lector QR al desmontar el componente (no oculta errores de red).

---

## Migraciones a ejecutar

```bash
# 1. Aplicar el SQL incremental en Supabase (SQL Editor)
#    prisma/migrations_manual/v8.2_incremental.sql

# 2. Regenerar cliente Prisma
cd sige
npm run db:generate

# 3. (Opcional, si no usaste el SQL manual) sincronizar schema directamente
npm run db:push
```
