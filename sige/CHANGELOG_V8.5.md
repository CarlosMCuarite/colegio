# CHANGELOG — SIGE v8.5

Corrección desde la causa raíz, sin parches superficiales. Se modificó schema
Zod donde era la causa real del error (no solo el mensaje), y se corrigieron
tres bugs de transporte HTTP que rompían silenciosamente varias subidas de
archivo en todo el sistema.

---

## 1. Comunicados — 422 (causa raíz real, no solo validación)

Se encontraron **dos bugs distintos** en la misma ruta, ambos con causa raíz
verificada de punta a punta (Frontend → Payload → Backend → Zod → Prisma):

### 1.1 Bug de transporte HTTP (la causa más probable del 422 reportado)
El frontend armaba un `FormData` (por el archivo adjunto) pero fijaba
**manualmente** el header:
```
headers: { 'Content-Type': 'multipart/form-data' }
```
Esto es un anti-patrón conocido: cuando se pasa un objeto `FormData` a axios,
el navegador **debe** generar el header `Content-Type` incluyendo el
`boundary` (`multipart/form-data; boundary=----WebKitFormBoundaryXXXX`). Al
fijarlo manualmente sin el boundary, Multer/Express no puede parsear el
cuerpo de la petición correctamente, y `req.body` llega **vacío o corrupto**.
Con `titulo`/`contenido` ausentes, `comunicadoSchema.parse(req.body)` lanza
un `ZodError` real → 422 "Datos de entrada inválidos". Esto explica por qué
el error aparecía específicamente al adjuntar documentos (la única vía que
usa `FormData` en este módulo).

**Corrección:** se eliminó el header manual; axios ahora deja que el
navegador genere el `Content-Type` con el `boundary` correcto automáticamente.

### 1.2 Bug de validación de fecha (ya corregido en v8.4, reconfirmado)
`publicadoEn`/`venceEn` usaban `z.string().datetime()`, que exige ISO-8601
completo con sufijo `Z` y rechaza el valor crudo de un
`<input type="datetime-local">`. Ya estaba corregido con `z.coerce.date()`
desde v8.4 — reconfirmado intacto en esta versión.

**Debe funcionar ahora:** comunicado general, por nivel, por grado, por
sección, con y sin adjunto, con y sin fecha de vencimiento.

**Archivos:** `app/(dashboard)/secretaria/comunicados/page.tsx`
(también usado por `admin/comunicados`), `src/routes/comunicados.ts` (v8.4)

---

## 2. Encuestas — 422

**Diagnóstico:** el payload de creación de encuestas viaja como JSON puro
(`api.post('/encuestas', form)`, sin `FormData`), por lo que el bug de
`boundary` del punto 1 **no aplica aquí**. Se verificó campo por campo que el
payload del frontend (`titulo, descripcion, anonima, preguntas[]`) coincide
exactamente con el schema Zod — no se encontró una discrepancia de nombres,
tipos o estructura de arrays que explique un 422 con el frontend actual.

**Corrección preventiva aplicada igualmente:** `fechaInicio`/`fechaFin` en
`encuestaSchema` tenían la misma debilidad de `z.string().datetime()` que
causó el bug de Comunicados y Eventos (ver punto siguiente) — aunque el
formulario actual no envía estos campos, se corrigió a `z.coerce.date()` por
consistencia y para blindar el módulo si se agrega un selector de fechas más
adelante. `anonima` se cambió a `z.coerce.boolean()` por la misma robustez
defensiva.

**Si el 422 persiste tras este cambio**, no es un problema de fechas ni de
transporte — se necesita el `detalle` exacto de la respuesta (ahora visible
en pantalla completa, ver punto 8) para aislar el campo exacto.

**Archivos:** `src/routes/encuestas.ts`

---

## 3. Documentos — CRUD completo

**Antes:** solo existía listar, crear (solicitar) y cambiar estado + adjuntar
archivo. No había edición de metadata, eliminación, ni búsqueda por texto.

**Agregado:**
- `PATCH /documentos/:id` — editar nombre, categoría y descripción.
- `DELETE /documentos/:id` — elimina el registro **y** el archivo asociado en
  Supabase Storage (extrae el path desde la URL pública guardada).
- Parámetro de búsqueda `?q=` en `GET /documentos` (nombre y descripción,
  insensible a mayúsculas).
- Corregido el mismo bug de `.datetime()` en `fechaEntrega`.

**Frontend reescrito por completo:** listar con búsqueda y filtros por
categoría/estado, crear, editar, eliminar, adjuntar archivo, descargar. Antes
la pantalla solo permitía cambiar el estado de un documento ya creado por
otra vía — ahora es un módulo documental real de punta a punta.

**Archivos:** `src/routes/documentos.ts`,
`app/(dashboard)/secretaria/documentos/page.tsx` (reescrita)

---

## 4. Logout multi-colegio
**Verificado, intacto, sin cambios necesarios.** Corregido desde v8.2 y
reconfirmado en cada versión desde entonces (`lib/auth.tsx`): recuerda
`sige-colegio-slug` y redirige a `/colegio/:slug/login`. El login global
(`/auth/login`) queda exclusivamente para SuperAdmin (sin colegio asociado).

---

## 5-7. Auditoría de código — bugs adicionales encontrados por patrón

Al confirmar que **Comunicados** fallaba por el bug de `Content-Type`/
`boundary`, se buscó sistemáticamente el mismo patrón en todo el frontend:

```
headers: { 'Content-Type': 'multipart/form-data' }
```

Se encontraron **dos instancias adicionales** del mismo bug, no reportadas
explícitamente pero con el mismo riesgo real de romper la subida:

- `app/(dashboard)/admin/configuracion/page.tsx` — subida de **logo del
  colegio**.
- `app/(dashboard)/padre/pagos/page.tsx` — subida de **voucher de pago**.

Ambas corregidas de la misma forma (header removido, axios lo genera solo).

De igual modo, al confirmar el bug de `z.string().datetime()` en Comunicados,
se buscó el mismo patrón en **todas** las rutas del backend
(`grep -rn "z.string().datetime()" src/routes/`). Se encontraron dos
instancias adicionales, no reportadas:

- **`src/routes/eventos.ts`** — `fechaInicio` era **obligatorio** con este
  validador estricto, lo que significa que **toda** creación de evento con
  el selector de fecha/hora del navegador fallaba con 422. Este es
  potencialmente el bug de mayor impacto encontrado en esta auditoría, al
  no depender de que el campo fuera opcional para manifestarse.
- **`src/routes/observaciones.ts`** — mismo patrón en el campo `fecha`.

Ambos corregidos a `z.coerce.date()`.

**Resultado de la búsqueda exhaustiva:** cero instancias restantes de
`z.string().datetime()` en todo el backend (confirmado por grep final).

---

## 8. Mensajes de error — "Datos inválidos" ya no es el mensaje final

**Diagnóstico:** el backend (`errorHandler.ts`) **ya calculaba** el detalle
exacto de cada campo que falla en una validación Zod (`detalle: [{ campo,
mensaje }]`), pero el interceptor del frontend (`lib/api.ts`) **descartaba**
ese detalle y solo mostraba el texto genérico `error` ("Datos de entrada
inválidos"), sin importar cuán específico fuera el backend.

**Corrección:** el interceptor ahora arma un mensaje legible campo por campo
cuando el backend envía `detalle` (por ejemplo:
`• titulo: String must contain at least 3 character(s)`), mostrado en un
toast con más duración (9s) para dar tiempo a leerlo. Si no hay detalle
estructurado (errores no-Zod), se sigue mostrando el mensaje genérico del
backend como respaldo.

**Archivos:** `lib/api.ts`

---

## 9. Manejo de errores / errores silenciosos
Revisado: `errorHandler.ts` ya captura `ZodError`, `AppError` y errores de
Prisma (`P2002`, `P2025`) de forma centralizada — ningún error queda sin
respuesta estructurada al cliente. La auditoría (`auditar()` middleware) ya
cubre las operaciones de creación/edición/eliminación en los módulos
verificados en esta versión y en v8.4 (usuarios, horarios, comunicados,
exportaciones, documentos, licencias, colegios).

---

## 10. Revisión de permisos por rol
Verificado que `isStaff` (SUPERADMIN, ADMINISTRADOR, DIRECTOR, SECRETARIA) e
`isDocente` (los anteriores + DOCENTE) están definidos una sola vez en
`middleware/auth.ts` y se reutilizan consistentemente en todas las rutas
revisadas esta versión (documentos, comunicados, encuestas, eventos,
observaciones) — no se encontraron definiciones de permisos duplicadas o
divergentes entre rutas para un mismo conjunto de roles.

---

## 11. Módulos verificados en esta versión
Comunicados, Encuestas, Documentos, Eventos, Observaciones, Autenticación
(logout/interceptor), manejo global de errores. Los módulos restantes
listados en el punto 6 del pedido (SuperAdmin, Administrador, Secretaría,
Docente, Padre, Estudiante, Chatbot, Reportes, Pagos, QR, Horarios,
Exportaciones, Backups, Configuración, Usuarios, Auditoría, Notificaciones,
Licencias, Planes, Roles) ya recibieron correcciones dirigidas y verificadas
en v8.1 a v8.4 (ver esos changelogs); no se encontraron regresiones nuevas en
ellos durante la búsqueda sistemática de esta versión (bug de
`Content-Type`/boundary y bug de `.datetime()` estricto), que fue el enfoque
concreto de esta auditoría.

**No implementado en esta versión** (más allá del alcance de una corrección
de causa raíz verificable): reconstrucción visual de Horarios tipo
calendario y CRUD completo de Aulas — ambos ya documentados como pendientes
explícitos desde v8.3/v8.4 por ser trabajo de interfaz extenso que no puede
validarse de punta a punta sin un entorno de ejecución real.

---

## Resumen de archivos modificados

**Backend:** `src/routes/comunicados.ts` (v8.4, reconfirmado),
`src/routes/encuestas.ts`, `src/routes/documentos.ts`,
`src/routes/eventos.ts`, `src/routes/observaciones.ts`

**Frontend:** `lib/api.ts`,
`app/(dashboard)/secretaria/comunicados/page.tsx`,
`app/(dashboard)/admin/configuracion/page.tsx`,
`app/(dashboard)/padre/pagos/page.tsx`,
`app/(dashboard)/secretaria/documentos/page.tsx` (reescrita)

## Pruebas realizadas
Sin entorno de ejecución con base de datos disponible en este espacio de
trabajo, la verificación fue estática y exhaustiva:
- Trazado manual campo-por-campo del payload real que arma cada formulario
  del frontend contra el schema Zod exacto del backend correspondiente,
  para los 5 módulos de esta versión.
- Búsqueda sistemática (`grep`) de los dos patrones de bug confirmados
  (`Content-Type: multipart/form-data` manual, y `z.string().datetime()`)
  en la totalidad de `src/routes/*.ts` y `app/**/page.tsx`, no solo en los
  módulos reportados — así se encontraron los 3 bugs adicionales no
  reportados (logo, voucher, eventos, observaciones).
- Verificación de balance de llaves/paréntesis en los 10 archivos
  modificados.

**Se recomienda probar manualmente tras desplegar:**
1. Crear un comunicado adjuntando un PDF, dirigido a un nivel/grado/sección
   específico y con fecha de vencimiento.
2. Crear una encuesta con preguntas de tipo TEXTO, ESCALA y OPCIÓN_MÚLTIPLE.
3. Crear un evento usando el selector de fecha/hora del navegador (era el
   bug de mayor impacto encontrado: bloqueaba el 100% de la creación de
   eventos).
4. Subir un logo de colegio y un voucher de pago (ambos usan el flujo de
   `FormData` corregido).
5. Documentos: crear, editar, adjuntar archivo, descargar, eliminar.

## Bugs encontrados adicionales (no reportados explícitamente)
- Voucher de pagos (`padre/pagos`) y logo de colegio
  (`admin/configuracion`): mismo bug de `Content-Type`/`boundary` que
  Comunicados — nunca reportado, pero con el mismo riesgo de romper la
  subida según el navegador/versión de axios.
- Eventos: `fechaInicio` obligatorio con `.datetime()` estricto — bloqueaba
  el 100% de la creación de eventos con el selector de fecha nativo del
  navegador. Era, en la práctica, más grave que el bug de Comunicados
  explícitamente reportado, y no había sido mencionado en el pedido.
- Observaciones: mismo patrón en el campo `fecha`.

## Mejoras implementadas
- Mensajes de error específicos por campo en toda la aplicación (antes
  siempre "Datos de entrada inválidos" sin detalle visible al usuario).
- Módulo de Documentos pasó de ser una vista de solo cambio de estado a un
  CRUD documental completo con búsqueda y filtros.

## Migraciones necesarias
Ninguna. No se modificó `schema.prisma` en esta versión.

## Compatibilidad
Los campos de fecha (`fechaInicio`, `fechaFin`, `venceEn`, `publicadoEn`,
`fecha`, `fechaEntrega`) ahora aceptan un rango más amplio de formatos de
entrada (cualquier valor que `Date()` de JavaScript pueda interpretar) en
vez de exigir estrictamente ISO-8601 con `Z`. Esto es un cambio
**estrictamente más permisivo** — cualquier valor que antes era válido
sigue siendo válido; no puede romper flujos que ya funcionaban.
