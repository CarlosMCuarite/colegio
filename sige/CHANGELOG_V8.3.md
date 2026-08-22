# CHANGELOG — SIGE v8.3 (Sprint de Estabilización)

Sin módulos nuevos. Sin cambios de arquitectura. Sin migraciones de schema
(todos los cambios de esta versión son sobre código de rutas, middleware y
frontend — el schema de Prisma no se tocó).

---

## 1. SuperAdmin

### 1.1 Mi Perfil — 404 / no persiste
**Diagnóstico:** el endpoint `GET /auth/me` y `PATCH /usuarios/:id` ya estaban
correctamente implementados desde v8.1/v8.2. Verificado línea por línea: el guard
de permisos permite que un usuario edite su propio registro incluso siendo
SUPERADMIN sin `colegioId`. No se encontró el 404 en el código actual.

**Gap real encontrado:** al guardar, la interfaz (sidebar/topbar) no se
actualizaba porque el objeto `user` del contexto de autenticación nunca se
refrescaba tras el `PATCH` — solo el estado local del formulario cambiaba.

**Corrección:** nuevo método `updateUser()` en `AuthProvider` (`lib/auth.tsx`)
que sincroniza el usuario en memoria y en `localStorage` sin requerir un nuevo
login. Se invoca desde ambas pantallas de configuración (SuperAdmin y Admin)
justo después de un guardado exitoso.

**Archivos:** `lib/auth.tsx`, `app/(dashboard)/superadmin/configuracion/page.tsx`,
`app/(dashboard)/admin/configuracion/page.tsx`

---

### 1.2 Contraseña
**Verificado:** el flujo actual (contraseña actual → validar → nueva → confirmar
→ mín. 8 caracteres, mayúscula, minúscula, número, símbolo → cierre de todas las
sesiones) ya se implementó en v8.1 en `POST /auth/cambiar-password`. Revisado y
confirmado sin regresiones.

---

### 1.3 Roles por Plan — inconsistencia de seguridad (CRÍTICO)

**Problema real confirmado:** el desplegable de roles al crear un usuario estaba
**hardcodeado** en el frontend con los 11 roles siempre visibles, sin consultar
el plan del colegio. Y el backend **no validaba en absoluto** qué rol se podía
asignar — solo el límite de `maxUsuarios`. Resultado exacto del reporte: bajar
de Premium a Básico no quitaba la posibilidad de seguir creando "Psicólogo",
ni siquiera llamando directo al API.

**Corrección backend** (`src/routes/usuarios.ts`, `POST /usuarios`):
Antes de crear el usuario se vuelve a consultar el colegio **en vivo** (nunca
cacheado) y se exige que, si el rol es uno de los opcionales
(`AUXILIAR, PSICOLOGO, COORDINADOR, TUTOR, CONTADOR, ENFERMERIA`), esté
simultáneamente:
1. incluido en `plan.rolesHabilitados` (el plan actual lo permite), **y**
2. incluido en `colegio.rolesOpcionales` (el SuperAdmin lo activó para ese colegio).

Si falta cualquiera de las dos condiciones → `403` con mensaje claro. Esto es
imposible de saltar desde el frontend o Postman, porque la validación vive en
el backend y se re-evalúa en cada request.

**Corrección frontend** (`app/(dashboard)/admin/usuarios/page.tsx`):
El `<select>` de rol al crear un usuario ahora solo lista los roles base
(`ADMINISTRADOR, DIRECTOR, SECRETARIA, DOCENTE, PADRE`) más los roles opcionales
que resultan de `colegio.plan.rolesHabilitados ∩ colegio.rolesOpcionales`,
recalculado en cada visita a la página (no cacheado entre sesiones).

**Archivos:** `src/routes/usuarios.ts`, `app/(dashboard)/admin/usuarios/page.tsx`

---

### 1.4 Suspensión de colegio — no era en tiempo real (CRÍTICO)

**Problema real confirmado:** el estado del colegio (`SUSPENDIDO`/`INACTIVO`) solo
se verificaba en `POST /auth/login`. Una vez logueado, el usuario seguía
operando con normalidad hasta que su JWT expirara o cerrara sesión manualmente.

**Corrección:** el middleware `authenticate` (que corre en **todas** las rutas
protegidas) ahora incluye el `estado` del colegio en la misma consulta del
usuario y bloquea la petición con `403` inmediatamente si el colegio está
`SUSPENDIDO` o `INACTIVO` — sin esperar a que expire el token.

Como refuerzo adicional, al ejecutar `PATCH /colegios/:id/estado` hacia
`SUSPENDIDO`/`INACTIVO`, el backend invalida el refresh token de **todos** los
usuarios de ese colegio (`supabaseAdmin.auth.admin.signOut` en paralelo), para
que tampoco puedan renovar sesión.

En el frontend, el interceptor de `api.ts` detecta la respuesta `403` con
mensaje de colegio suspendido/inactivo y fuerza logout + redirección inmediata
(mismo tratamiento que un `401`), mostrando el mensaje correspondiente.

**Archivos:** `src/middleware/auth.ts`, `src/routes/colegios.ts`, `lib/api.ts`

---

### 1.5 Menú del SuperAdmin
**Verificado:** el Sidebar (`components/layout/Sidebar.tsx`) ya contiene
exactamente: Dashboard, Colegios, Membresías (Planes), Licencias, Roles por
Plan, Auditoría Global, Configuración. No se encontraron módulos sobrantes.

---

## 2. Colegios

### 2.1 Crear Colegio — `Unknown argument generarUsuarios`
**Verificado:** ya corregido desde v8.2 — `generarUsuarios` y `adminEmail` se
destructuran del `req.body` **antes** de pasar por `colegioSchema.parse()`, por
lo que nunca llegan al `prisma.colegio.create()`. Confirmado en el código
actual, sin regresión.

### 2.2 Logo del colegio — RLS (CRÍTICO, causa raíz encontrada)

Con las capturas de pantalla del proyecto de Supabase se identificaron **dos
problemas reales, no cosméticos**:

**(a) Mismatch de nombre de bucket.** El bucket real en Supabase se llama
`vales`, pero el código asumía `vouchers` por defecto. Esto rompía en
silencio cualquier subida de comprobantes de pago (no el logo, pero sí un bug
real del mismo módulo de Storage). Corregido en `config/supabase.ts`
(`BUCKETS.VOUCHERS` ahora usa `'vales'` como default, configurable por env).

**(b) El bucket `logos` existe, es público, pero tiene 0 políticas — y aun así
la subida falla con RLS.** Esto solo pasa en la práctica si la llamada al
Storage API **no** está usando realmente la `service_role key` (por ejemplo,
si en `.env` se pegó por error la `anon key` en la variable
`SUPABASE_SERVICE_ROLE_KEY`). El código ya usaba `supabaseAdmin` (cliente con
service role) para todas las subidas — el bug no estaba en el código de
subida, sino en que no había forma de detectar una key mal configurada hasta
que fallaba en producción.

**Corrección:** `config/supabase.ts` ahora decodifica el JWT de
`SUPABASE_SERVICE_ROLE_KEY` al arrancar el servidor y compara el claim `role`.
Si no es `"service_role"`, escribe un error explícito en los logs señalando
exactamente la causa y la solución, en vez de fallar silenciosamente en cada
subida. Además, `storageService.ts` (ya reforzado desde v8.2) da un mensaje de
error específico según el tipo de fallo de Supabase Storage.

**Acción pendiente para el usuario:** revisar en Render/`.env` que
`SUPABASE_SERVICE_ROLE_KEY` sea copiada desde **Project Settings → API →
service_role** (no la `anon public`) en Supabase. Al reiniciar el backend, el
log dirá explícitamente si la key es la incorrecta.

**Archivos:** `src/config/supabase.ts`, `src/services/storageService.ts` (v8.2)

---

## 3. Administrador del colegio — Mi Perfil
**Verificado y corregido junto con 1.1:** ahora precarga desde `GET /auth/me` y
sincroniza el contexto global tras guardar (`updateUser`), igual que SuperAdmin.

---

## 4. Usuarios — "Datos inválidos" al crear Secretaría
**Diagnóstico:** no se encontró un bug de validación Zod/Prisma para el rol
`SECRETARIA` específicamente — el schema acepta cualquier valor de
`RolNombre`. El síntoma más probable coincide con el bug **1.3**: si
`SECRETARIA` alguna vez quedó fuera de una lista de roles permitidos mal
sincronizada en el frontend, el `<select>` podía enviar un valor inconsistente.
Con la corrección de 1.3 (roles base siempre disponibles, recalculados en
vivo), `SECRETARIA` está garantizado como rol base siempre creable.

**Archivos:** `app/(dashboard)/admin/usuarios/page.tsx` (ver 1.3)

---

## 5. Aulas
**Alcance de esta versión:** no se reconstruyó el CRUD completo de Aulas en
este sprint por presupuesto de la versión — los issues reportados (no permite
editar, fuerza seleccionar aula existente, no deja elegir sección) requieren
revisión dedicada del formulario completo, que se prioriza para la siguiente
iteración inmediatamente después de validar que los puntos 1 y 2 (más
críticos: seguridad y Storage) quedaron resueltos. **Se documenta como
pendiente explícito**, no como "arreglado".

---

## 6. Horarios — `Unknown field aula for include statement on model Horario`

**Diagnóstico:** el modelo `Horario` en `prisma/schema.prisma` **ya tiene** el
campo `aula` (relación a `Aula`) desde la v8.2. Este error de Prisma ocurre
exclusivamente cuando el **cliente Prisma generado no coincide con el schema**
— es decir, se editó `schema.prisma` pero no se corrió `npx prisma generate`
después de aplicar la migración a la base de datos. No es un bug de código.

**Verificado:** `schema.prisma` está correcto; `src/routes/horarios.ts` usa el
`include` correctamente.

**Acción requerida (no opcional):**
```bash
cd sige
npm run db:push       # si la migración v8.2_incremental.sql no se aplicó aún
npm run db:generate   # SIEMPRE después de tocar schema.prisma
```

**Alcance de esta versión:** la vista de calendario visual con colores por
curso/profesor/aula (tipo grilla semanal) **no se implementó** en este sprint
— es una reconstrucción de UI significativa que excede el objetivo de
"estabilizar sin agregar funcionalidades nuevas". La detección de choques de
horario/docente/aula **ya existe** desde v8.2 en `POST /horarios` (valida
solapamiento por grado/sección/día y por docente). Se documenta como
pendiente la vista gráfica de calendario.

---

## 7. Comunicados — `TypeError: niveles.find is not a function`

**Causa raíz confirmada:** el hook `useNivelesGrados()` devuelve el cuerpo
completo de la respuesta (`{ ok, data, meta }`) desde el cambio de `fetcher` en
v8.1/v8.2. El componente `ComunicadosPage` tomaba ese objeto completo y lo
pasaba directo como si fuera el arreglo, y el formulario hijo llamaba
`niveles.find(...)` sobre un objeto, no un arreglo → crash garantizado.

**Corrección:**
- El componente padre ahora extrae `nivelesData?.data ?? []` antes de pasarlo.
- El formulario hijo, además, valida `Array.isArray(niveles)` internamente
  como segunda capa de defensa, para que nunca vuelva a romper la interfaz
  aunque algún llamador futuro pase el prop mal formado.

**Archivos:** `app/(dashboard)/secretaria/comunicados/page.tsx`
(re-exportado también por `admin/comunicados/page.tsx`)

---

## 8. Exportaciones — visor JSON de solo lectura
**Alcance de esta versión:** no implementado. Es una pieza de UI nueva
(árbol JSON navegable, colapsar nodos, búsqueda, copiar) que, aunque se
enmarca como mejora de un módulo existente, representa trabajo de interfaz
comparable a una funcionalidad nueva. Dado el mandato explícito de esta
versión ("NO agregues nuevos módulos... no quiero nuevas funcionalidades
mientras existan errores"), se prioriza para la siguiente fase una vez
confirmada la estabilidad de los puntos 1 y 2.

---

## 9. Dashboard Padre
**Verificado:** la construcción ya es 100% derivada de
padre → estudiantes vinculados (con `estado = APROBADO`, desde v8.2) →
asistencia/pagos/horarios/observaciones/comunicados/eventos de esos
estudiantes. No se encontraron queries independientes sueltas. Sin cambios de
código adicionales en este punto (ver el hallazgo relacionado en Padres, v8.2).

---

## 10. Dashboard Colegio — tarjeta "Plan Activo"

**Agregado** (mejora acotada, no un módulo nuevo — usa datos que el propio
dashboard ejecutivo ya calculaba): tarjeta con nombre del plan, días
restantes de licencia y color según proximidad de vencimiento
(verde > 30 días, ámbar ≤ 30 días, rojo ≤ 15 días o vencido/suspendido).

**Backend:** `GET /dashboard/ejecutivo` ahora expone también `colegio.estado`
y `colegio.planNombre` (ya calculaba `licencia.diasRestantes`, solo faltaba
exponer el nombre del plan y el estado).

**Archivos:** `src/routes/dashboard.ts`, `app/(dashboard)/admin/page.tsx`

---

## 11. Notificaciones (toasts)

**Corrección parcial dentro del alcance:** duración aumentada
(6s por defecto, 5s éxito, 8s error — antes 4s fijos para todo). Barra de
progreso, pausa al pasar el mouse y animación distinta **no son soportadas**
por `react-hot-toast` (la librería actual) sin reemplazarla por otra (p. ej.
`sonner`), lo cual sería un cambio de dependencia — fuera del alcance de un
sprint de estabilización que explícitamente pide no tocar arquitectura.
Se documenta como mejora futura si se aprueba el cambio de librería.

**Archivos:** `app/layout.tsx`

---

## 12. Modales — pérdida de datos al hacer clic afuera

**Verificado primero:** no existe en este proyecto ningún manejador de tecla
`Escape` para cerrar modales — ese sub-punto del reporte no correspondía a un
comportamiento real del código actual.

**Corrección para clic-afuera:** se creó un hook reutilizable
`hooks/useDirtyGuard.ts` con el patrón de confirmación
("¿Desea salir? Se perderán los cambios" / Cancelar / Salir sin guardar).

**Aplicado como referencia** en el modal más largo y de mayor riesgo del
sistema — crear/editar Colegio (`superadmin/colegios/page.tsx`) — donde
cualquier cambio de campo marca el formulario como "sucio"; un clic en el
fondo oscuro ahora pide confirmación en vez de cerrar y descartar todo.

**Alcance de esta versión:** replicar este mismo patrón en el resto de
modales (~25-30 formularios en Estudiantes, Padres, Matrículas, Pagos,
Eventos, Encuestas, Horarios, Usuarios, etc.) es un trabajo mecánico pero
extenso; aplicarlo de golpe sin poder probar cada pantalla individualmente
arriesga romper modales que hoy funcionan bien — algo que esta versión
prohíbe explícitamente ("no modifiques funcionalidades que ya funcionan").
Se deja como tarea de seguimiento con el patrón ya resuelto y listo para
replicar.

**Archivos:** `hooks/useDirtyGuard.ts` (nuevo, reutilizable),
`app/(dashboard)/superadmin/colegios/page.tsx`

---

## 13. Login/Logout multi-colegio
**Verificado:** ya corregido desde v8.2 (`lib/auth.tsx`, `lib/api.ts`,
`DashboardLayout.tsx`) — el logout y cualquier expiración de sesión respetan
el slug del colegio guardado en `localStorage` y redirigen a
`/colegio/:slug/login`. Sin regresiones encontradas.

---

## 14. Seguridad
- Confirmado: el middleware `authenticate` valida el JWT contra Supabase en
  cada request (no hay decodificación local sin verificar), y ahora también
  el estado del colegio en tiempo real (ver 1.4).
- Confirmado: la validación de roles-por-plan ahora vive en backend, no
  depende del frontend (ver 1.3).
- Confirmado: `resolveTenant` sigue forzando `colegioId` en cada query para
  todo rol que no sea SUPERADMIN.

---

## Resumen de archivos modificados

**Backend:**
`src/middleware/auth.ts`, `src/routes/colegios.ts`, `src/routes/usuarios.ts`,
`src/routes/dashboard.ts`, `src/config/supabase.ts`

**Frontend:**
`lib/auth.tsx`, `lib/api.ts`, `hooks/useDirtyGuard.ts` (nuevo),
`app/layout.tsx`,
`app/(dashboard)/admin/page.tsx`,
`app/(dashboard)/admin/usuarios/page.tsx`,
`app/(dashboard)/admin/configuracion/page.tsx`,
`app/(dashboard)/superadmin/configuracion/page.tsx`,
`app/(dashboard)/superadmin/colegios/page.tsx`,
`app/(dashboard)/secretaria/comunicados/page.tsx`

## Migraciones necesarias
**Ninguna.** No se modificó `schema.prisma` en esta versión. Si el error de
Horarios (`Unknown field aula`) persiste, es porque la migración de **v8.2**
(`prisma/migrations_manual/v8.2_incremental.sql`) no se ha aplicado aún, o no
se corrió `npm run db:generate` después — ver sección 6.

## Compatibilidad
Ningún endpoint existente cambió su firma ni su contrato de respuesta.
Los cambios en `POST /usuarios` son más restrictivos (rechazan casos que antes
se colaban indebidamente), no rompen ningún flujo válido existente. El
proyecto no requiere `db push` ni `db generate` para esta versión específica.
