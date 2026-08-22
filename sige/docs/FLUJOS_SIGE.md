# FLUJOS_SIGE.md — Documentación Técnica de Flujos del Sistema
# SIGE V8.1 — Sistema Integral de Gestión Escolar

---

## 1. SUPERADMINISTRADOR

```
Inicio: Autenticación con carce240201@gmail.com
↓
Validaciones: email + password en Supabase Auth → estado activo en BD
↓
Proceso: JWT devuelto → localStorage (token, user, colegio-id vacío)
↓
Permisos: rol=SUPERADMIN → acceso total sin filtro de colegioId
↓
Base de datos: tabla usuarios WHERE supabaseId = auth.user.id
↓
Notificaciones: ninguna
↓
Auditoría: AuditoriaAccion.LOGIN registrado automáticamente
↓
Fin: redirige a /superadmin
```

**Acciones disponibles:**
- CRUD de Planes (nombre único, sin tipo fijo)
- CRUD de Colegios (con slug, branding, generación de staff)
- Gestión de Licencias (renovar desde hoy, suspender, reactivar)
- Roles por Plan (activar/desactivar roles opcionales por colegio)
- Auditoría global (sin filtro de tenant)
- Soporte técnico: "Ingresar como Colegio" (magic link con auditoría)
- Configuración de perfil y contraseña

---

## 2. FLUJO DE COLEGIO

```
Inicio: SuperAdmin crea un Plan
↓
Validaciones: nombre único del plan
↓
Proceso: Plan.create() con duracionDias, maxEstudiantes, rolesHabilitados
↓
Permisos: isSuperAdmin
↓
Base de datos: tabla planes
↓
Auditoría: AuditoriaAccion.CREAR en módulo PLANES
↓
Siguiente: SuperAdmin crea Colegio

Inicio: SuperAdmin crea Colegio
↓
Validaciones: planId requerido, slug único (autogenerado si no se provee)
↓
Proceso:
  1. Colegio.create() con campos Prisma (sin generarUsuarios)
  2. Licencia.create() con estado=ACTIVA
  3. Si generarUsuarios=true: crear Admin, Director, Secretaria en Supabase Auth
     + Usuario.create() para cada uno
↓
Permisos: isSuperAdmin
↓
Base de datos: colegios + licencias + usuarios
↓
Notificaciones: credenciales devueltas en la respuesta
↓
Auditoría: AuditoriaAccion.CREAR en módulo COLEGIOS
↓
Fin: colegio activo, accesible en /colegio/:slug
```

---

## 3. LICENCIAS

```
Inicio: SuperAdmin gestiona licencia de un colegio
↓
Validaciones: colegioId válido, meses entre 1 y 36
↓
Proceso RENOVAR:
  - inicio = HOY (siempre, no se suma al fin anterior)
  - fin = hoy + N meses
  - Colegio.update(licenciaInicio, licenciaFin, estado=ACTIVO)
  - Licencia.create(estado=ACTIVA, motivo con fecha)
↓
Proceso SUSPENDER:
  - Colegio.update(estado=SUSPENDIDO)
  - Licencia.create(estado=SUSPENDIDA)
  - Usuarios del colegio NO podrán ingresar (login verifica estado)
↓
Proceso REACTIVAR:
  - Colegio.update(estado=ACTIVO)
↓
Permisos: isSuperAdmin
↓
Base de datos: colegios + licencias
↓
Auditoría: RENOVAR / SUSPENDER / RESTAURAR
↓
Estados: ACTIVA | PRUEBA | SUSPENDIDA | VENCIDA
```

**Alertas automáticas:** colegios con licenciaFin ≤ 30 días → endpoint `/membresias/alertas`

---

## 4. PLANES

```
Inicio: SuperAdmin gestiona planes
↓
Proceso CREATE:
  - Validar nombre único (case insensitive)
  - Plan.create() con: nombre, precio, duracionDias, maxEstudiantes,
    maxUsuarios, maxAlmacenamientoGB, modulosActivos, rolesHabilitados
↓
Proceso EDIT:
  - Validar nombre único si cambia
  - Plan.update() — NO rompe colegios existentes
↓
Proceso TOGGLE:
  - Si desactivar: verificar que no haya colegios ACTIVOS usando el plan
↓
Proceso DELETE:
  - Solo si ningún colegio (activo o histórico) usa el plan
↓
Auditoría: CREAR / ACTUALIZAR
```

---

## 5. USUARIOS

```
Inicio: Admin/SuperAdmin crea usuario
↓
Validaciones: email único en Supabase + BD, rol permitido, plan no excede maxUsuarios
↓
Proceso:
  1. supabaseAdmin.createUser(email, password)
  2. Usuario.create(supabaseId, colegioId, rol, ...)
↓
Permisos: isAdmin (SUPERADMIN + ADMINISTRADOR)
↓
Base de datos: tabla usuarios
↓
Auditoría: AuditoriaAccion.CREAR
↓
Fin: usuario puede hacer login en /colegio/:slug/login
```

---

## 6. PADRES

```
Inicio: Secretaria registra padre/apoderado
↓
Validaciones: DNI único en el colegio
↓
Proceso:
  1. Padre.create(colegioId, dni, nombres, apellidos, email, telefono)
  2. Si crearAcceso=true: crear Usuario(rol=PADRE) + Supabase Auth
  3. Vincular con estudiantes via PadreEstudiante
↓
Permisos: isStaff (Admin, Director, Secretaria)
↓
Base de datos: padres + padreEstudiante + usuarios
↓
Auditoría: AuditoriaAccion.CREAR
```

---

## 7. ESTUDIANTES

```
Inicio: Secretaria registra estudiante
↓
Validaciones: DNI único en el colegio, plan no excede maxEstudiantes
↓
Proceso:
  1. Estudiante.create(colegioId, dni, nombres, apellidos, ...)
  2. codigoQR = dni por defecto
↓
Permisos: isStaff
↓
Base de datos: tabla estudiantes
↓
Auditoría: AuditoriaAccion.CREAR
↓
Fin: estudiante puede ser matriculado
```

---

## 8. MATRÍCULAS

```
Inicio: Secretaria registra matrícula
↓
Validaciones:
  - Estudiante existe en el colegio
  - nivelGradoId válido para el colegio
  - No existe matrícula activa para el mismo año
↓
Proceso:
  1. Matricula.create(colegioId, estudianteId, nivelGradoId, seccionId, anoEscolar)
  2. Desactivar matrículas anteriores del mismo año si existen
↓
Permisos: isStaff
↓
Base de datos: tabla matriculas
↓
Auditoría: AuditoriaAccion.CREAR
```

---

## 9. ASISTENCIA

```
Inicio: Docente/Auxiliar registra asistencia (manual o QR)
↓
Validaciones: estudianteId + fecha → unicidad por día
↓
Proceso QR:
  1. Escanear código QR del estudiante
  2. POST /qr/escanear → busca estudiante por codigoQR
  3. Asistencia.create(estado=PRESENTE, horaLlegada=now)
  4. Si ya existe: marcar como duplicado
  5. Si llega tarde (hora > horarioEntrada): estado=TARDANZA
↓
Proceso Manual:
  - Docente registra estado por lista de estudiantes
↓
Permisos: isDocente (Docente, Auxiliar, Tutor, Coordinador, Admin, Director)
↓
Base de datos: tabla asistencias
↓
Notificaciones: FCM al padre si estado=AUSENTE
↓
Auditoría: AuditoriaAccion.CREAR
```

---

## 10. HORARIOS

```
Inicio: Admin registra horario por grado/sección
↓
Validaciones: diaSemana (1-7), horaInicio < horaFin, nivelGradoId válido
↓
Proceso:
  - Horario.create(colegioId, nivelGradoId, seccionId, diaSemana, horaInicio, horaFin, materia)
↓
Permisos: isAdmin
↓
Base de datos: tabla horarios
↓
Vista padre/docente: agrupado por día de la semana
```

---

## 11. PAGOS

```
Inicio: Padre sube voucher de pago
↓
Validaciones: monto > 0, tipo válido, archivo adjunto
↓
Proceso:
  1. Pago.create(colegioId, padreId, estado=EN_REVISION, monto, tipo)
  2. uploadFile(BUCKETS.vouchers, file) → voucherUrl
  3. Pago.update(voucherUrl)
↓
Secretaria revisa:
  1. GET /pagos?estado=EN_REVISION
  2. PATCH /pagos/:id → estado=APROBADO o RECHAZADO
  3. Si RECHAZADO: motivo obligatorio
↓
Permisos: PADRE puede crear, isStaff puede aprobar/rechazar
↓
Base de datos: tabla pagos
↓
Notificaciones: FCM al padre cuando se aprueba/rechaza
↓
Auditoría: APROBAR / RECHAZAR
```

---

## 12. COMUNICADOS

```
Inicio: Admin/Secretaria/Director crea comunicado
↓
Validaciones: título, contenido, destinatarios definidos
↓
Proceso:
  1. Comunicado.create(colegioId, titulo, contenido, paraElColegio, nivelEducativo)
  2. Si adjunto: uploadFile(BUCKETS.documentos)
  3. Si paraElColegio=true: visible en portal público
↓
Permisos: isStaff
↓
Base de datos: tabla comunicados
↓
Notificaciones: FCM a padres del nivel/grado seleccionado
↓
Auditoría: AuditoriaAccion.CREAR
```

---

## 13. ENCUESTAS

```
Inicio: Secretaria/Admin crea encuesta
↓
Proceso:
  1. Encuesta.create(titulo, descripcion, anonima)
  2. Pregunta.create() para cada pregunta con tipo (TEXTO/OPCION_UNICA/ESCALA)
  3. Estado inicial: BORRADOR
↓
Activar: PATCH /encuestas/:id/estado → ACTIVA
↓
Responder (Padre):
  1. GET /encuestas?estado=ACTIVA
  2. POST /encuestas/:id/responder → RespuestaEncuesta.create()
↓
Cerrar: PATCH /encuestas/:id/estado → CERRADA
↓
Permisos: isStaff para crear, PADRE para responder
↓
Base de datos: encuestas + preguntas + respuestasEncuesta
```

---

## 14. CHATBOT

```
Inicio: Padre envía mensaje al chatbot
↓
Proceso:
  1. POST /chatbot/mensaje → busca respuesta en ChatbotPregunta por similitud
  2. Si encuentr coincidencia: devuelve respuesta predefinida
  3. Si no: respuesta por defecto
↓
Admin configura respuestas: CRUD en /chatbot/preguntas
↓
Permisos: PADRE puede consultar, isAdmin para configurar
↓
Base de datos: tabla chatbotPreguntas
```

---

## 15. EXPORTACIONES

```
Inicio: Admin solicita exportación
↓
Tipos disponibles: estudiantes, asistencia, pagos, matrículas (CSV/Excel)
↓
Proceso:
  1. Exportacion.create(tipo, estado=PROCESANDO)
  2. Generar archivo en background
  3. uploadFile(BUCKETS.documentos) → url
  4. Exportacion.update(estado=COMPLETADO, url)
↓
Permisos: isAdminDir
↓
Base de datos: tabla exportaciones
↓
Auditoría: AuditoriaAccion.EXPORTAR
```

---

## 16. AUDITORÍA

```
Proceso automático via middleware:
↓
Middleware auditar({ modulo, accion, getRecursoId }) captura:
  - usuarioId (del JWT)
  - colegioId (del tenant)
  - accion (CREAR/ACTUALIZAR/ELIMINAR/LOGIN/LOGOUT/etc.)
  - modulo (AUTH/COLEGIOS/ESTUDIANTES/etc.)
  - ip (X-Forwarded-For o req.ip)
  - userAgent
  - descripcion (opcional)
↓
Auditoria.create() en cada operación relevante
↓
SuperAdmin: GET /auditoria/global (sin filtro de tenant)
Admin/Director: GET /auditoria (filtrado por colegioId)
↓
Filtros: usuarioId, modulo, accion, desde, hasta, page/limit
```

---

## 17. CONFIGURACIÓN

### SuperAdmin
```
/superadmin/configuracion
↓
Tab Perfil: GET /auth/me → precargar datos → PATCH /usuarios/:id
Tab Contraseña: POST /auth/cambiar-password
  - Verificar passwordActual via signInWithPassword
  - Validar requisitos (8 chars, mayúscula, minúscula, número, símbolo)
  - Actualizar via admin.updateUserById
  - Cerrar todas las sesiones (admin.signOut)
  - Auditoría registrada
```

### Admin/Colegio
```
/admin/configuracion
↓
Tab Institución:
  - PATCH /colegios/:id → persiste todos los campos incluyendo
    historia, misión, visión, colores, whatsapp
  - POST /colegios/:id/logo → sube a Storage (service_role bypassa RLS)
Tab Perfil: igual que SuperAdmin
Tab Contraseña: igual que SuperAdmin
```

---

## MULTI-TENANT

```
Cada request autenticado pasa por middleware resolveTenant:
↓
Si SUPERADMIN: req.colegioId = header X-Colegio-Id (opcional) → puede ver todo
Si otro rol: req.colegioId = usuario.colegioId (obligatorio)
↓
Todas las queries incluyen WHERE colegioId = req.colegioId
→ Aislamiento completo entre colegios
→ Ningún usuario ve datos de otro colegio
```

---

## PORTAL PÚBLICO

```
/colegio/:slug → GET /public/colegio/:slug (sin auth)
  - Muestra: logo, nombre, historia, misión, visión, eventos, galería, contacto
  - Solo si colegio.estado ≠ INACTIVO

/colegio/:slug/login → Login con branding del colegio
  - Carga branding via GET /public/colegio/:slug/check
  - Login normal → redirige por rol
```

---

## STORAGE (Supabase)

```
Buckets: logos, vouchers, documentos, avatares
↓
Upload: storageService.uploadFile(bucket, buffer, filename, mimetype, folder)
  - Usa supabaseAdmin (service_role) → bypasa RLS
  - Si imagen: convierte a WebP automáticamente
  - Devuelve URL pública
↓
Configurar buckets en Supabase: ejecutar docs/SUPABASE_STORAGE_SETUP.sql
```
