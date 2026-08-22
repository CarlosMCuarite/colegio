# SIGE — Cambios de esta sesión (sobre v8.18)

## 🔴 Backup / RLS — nueva pista (revisa esto primero)

Decodifiqué tu `SUPABASE_SERVICE_ROLE_KEY` del `.env` que pegaste: el JWT
**sí dice `role: "service_role"` correctamente** — no es la clave equivocada.
El bucket `backups` también existe (lo confirma tu captura de Supabase Storage).
Aun así te sigue dando `403 row-level security policy` al subir.

La pista más fuerte que encontré: tu `.env` ya tiene
`NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."` — ese es el **nuevo**
formato de claves de Supabase (reemplazando los JWT `anon`/`service_role`
desde noviembre 2025). Eso sugiere que tu proyecto ya migró al sistema nuevo,
y muchas veces eso significa que las claves JWT "legacy" (como tu
`SUPABASE_SERVICE_ROLE_KEY` actual) quedan **deshabilitadas** en el gateway
aunque el JWT en sí siga siendo válido y se decodifique bien — por eso el 403.

**Qué revisar:** Supabase Dashboard → tu proyecto → Settings → **API Keys**.
Ahí busca si existe una clave nueva tipo `sb_secret_...` (o el botón para
crear una). Si existe, cópiala y reemplaza el valor de
`SUPABASE_SERVICE_ROLE_KEY` en tu `.env` con esa clave `sb_secret_...` (el
cliente de Supabase la acepta igual, no hay que tocar código). Si en esa
misma pantalla ves un aviso de "Legacy keys disabled", esa es la confirmación.

Si de casualidad NO es esto (las legacy siguen habilitadas), avísame y
reviso otra pista.

## Arreglado — bugs reales encontrados

### 1. "Mis hijos" y "Asistencia" del padre — la causa raíz real (no era de la BD)
Encontré el bug exacto: `app/(dashboard)/padre/hijos/page.tsx` y
`.../padre/asistencia/page.tsx` leían `data.estudiantes`, pero la respuesta
real del backend es `{ ok:true, data: { estudiantes:[...], ... } }` — un
nivel más anidado. Por eso SIEMPRE salía vacío aunque el hijo ya estuviera
vinculado, mientras que en "Inicio" sí aparecía (esa página sí hacía el
unwrap correcto). Corregido en ambos archivos — nada que tocar en la base
de datos ni en el backend, era puramente un bug de frontend.

### 2. Eventos no aparecían para el padre (ni para nadie con "próximos")
Encontrado: al crear un evento desde un `<input type="date">` (sin hora), se
guarda como medianoche UTC de ese día. Como Perú va 5 horas detrás de UTC,
para cuando en Perú todavía es de noche del día anterior, en UTC esa
medianoche del evento **ya pasó** — así que cualquier filtro de "eventos
próximos" (que compara contra el instante exacto de "ahora") lo descartaba
antes de que llegara el día en Perú. Corregido en `padre/eventos/page.tsx`
y en `GET /eventos/proximos` del backend: ahora se filtra desde el
**inicio del día de hoy**, no desde el instante exacto. El calendario de
Secretaría/Admin no tenía este bug (usa rango de mes completo).

### 3. Plantilla de Carnet se quedaba cargando para siempre
Si la petición fallaba (por ejemplo, si faltó correr `npx prisma generate`
después de agregar la columna `carnetConfig`), la pantalla no tenía manejo
de error y el spinner giraba infinito. Ahora muestra un mensaje claro con
botón de reintentar. **Por las dudas, corre `npx prisma generate` una vez
más y reinicia el backend** — tus capturas confirman que el SQL para agregar
la columna sí corrió bien.

### 4. Documentos del padre
- Los vouchers ahora se abren en un modal (mismo componente que ya usa
  Facturación), no en pestaña nueva con la imagen cruda.
- Los comunicados ahora se pueden abrir y leer completos en un modal — antes
  solo aparecía la fila, sin forma de ver el contenido.

### 5. Horarios — botón de imprimir
Agregado en Padre y Docente (con encabezado limpio al imprimir, sin sidebar
ni botones).

## Rol Director — no encontré ningún bug de código
Revisé TODAS las páginas enlazadas desde el sidebar de Director
(`/director`, `/director/estudiantes`, `/director/asistencia`,
`/director/pagos`, `/admin/facturacion`, `/director/permisos`,
`/director/auditoria`, `/admin/configuracion`) y el `allowedRoles` de cada
una — todas incluyen correctamente `DIRECTOR`. También revisé el login y el
middleware del backend: ninguno bloquea el rol Director.

Mi sospecha, sin poder confirmarlo: la cuenta de prueba que usaste como
Director puede no tener un colegio asignado, o el colegio de esa cuenta esté
en estado `SUSPENDIDO`/`INACTIVO` — eso SÍ produce un rechazo legítimo (no es
un bug, es el sistema protegiendo el acceso). Para poder revisarlo bien,
la próxima vez cuéntame el mensaje exacto que aparece (o mándame captura) al
momento de intentar entrar como Director.

## Nuevo: Semilla de datos de prueba (2 colegios demo)

```bash
npm run seed:demo             # crea 2 colegios de prueba con datos completos
npm run seed:demo:eliminar    # borra TODO lo anterior, como si nunca hubiera existido
```

Cada colegio demo (`demo-los-andes`, `demo-pacifico`) incluye: plan +
licencia activa, administrador + director + secretaria + 3 docentes, 10
estudiantes matriculados con sus padres vinculados (algunos padres con 2
hijos, para probar ese caso), horarios, 10 pagos (mezcla de aprobados y en
revisión), 5 comunicados, 5 eventos, asistencia de los últimos 5 días para
cada estudiante, y 3 permisos de salida.

Al final del `seed:demo` te imprime en consola las credenciales de acceso de
cada rol (contraseña única para todos: `Demo12345!`).

Es 100% seguro correr `seed:demo:eliminar` — solo borra colegios cuyo `slug`
empiece con `demo-`, nunca toca tus colegios reales (Colegio de Encinas,
etc.), y también elimina las cuentas de Supabase Auth que creó, no solo las
filas de la base de datos.

## Pendiente
- Confirmar si el ajuste de la clave `service_role`/`sb_secret_` resolvió el
  backup.
- Rol Director: esperando el mensaje/captura exacto del error para poder
  diagnosticar si es la cuenta de prueba o algo más.
