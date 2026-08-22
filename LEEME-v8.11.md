# SIGE v8.11 — Paquete COMPLETO (todo el proyecto)

⚠️ A diferencia de los paquetes anteriores (que solo traían los archivos
modificados), este trae **las carpetas `sige/` y `sige-frontend/` completas**
con el estado actual y acumulado de todas las correcciones de esta
conversación. Esto es para eliminar cualquier duda de si algo quedó sin
copiar. Puedes:

- **Opción A (recomendada):** reemplazar tus carpetas `sige/` y
  `sige-frontend/` completas por estas (después de respaldar tu `.env` de
  cada una, porque no vienen incluidos aquí por seguridad).
- **Opción B:** usar un diff/comparador de carpetas contra tu proyecto
  actual y copiar solo lo que cambió.

Después de copiar:
```
cd sige
npm install
npx prisma generate
```
```
cd sige-frontend
npm install
```

Y corre estas 2 cosas en el SQL Editor de Supabase, en este orden:
1. `sige/prisma/migrations_manual/v8.11_pagos_yape_plin_plan.sql` (nuevo)
2. `sige/docs/SUPABASE_STORAGE_SETUP.sql` completo de nuevo (corregí un bug
   de permisos ahí, ver punto 3 abajo)

(El `v8.10` ya lo corriste la vez pasada, no hace falta repetirlo.)

---

## 1. Backups (SuperAdmin) — "Object not found" al descargar/verificar
No es un bug de código: el archivo referenciado en la base de datos ya no
existe en el bucket `backups` de Supabase Storage (lo más probable es que el
bucket nunca se creó del todo, o se recreó manualmente en algún momento).
Agregué:
- Un botón **"Purgar rotos"** en Backups → revisa todos los backups
  "Completado" y elimina de la lista los que ya no tienen archivo real en
  Storage.
- El mensaje de error ahora te dice exactamente qué hacer.
- **Acción tuya:** vuelve a correr `SUPABASE_STORAGE_SETUP.sql` completo (crea
  el bucket `backups` si no existe) y genera un backup nuevo con "Generar
  ahora" para confirmar que ya funciona.

## 2. Configuración — "quitaste las opciones de personalizar"
Revisé el código y las opciones de Logo/Misión/Visión/WhatsApp/Colores
**nunca se quitaron** — pero si tu proyecto local no tenía copiados los
archivos de la ronda anterior, es como si no hubieran estado ahí. Con este
paquete completo ya no debería haber ninguna duda: todo está en
`sige-frontend/app/(dashboard)/admin/configuracion/page.tsx`.

**Bug real que sí encontré y arreglé:** `/padre/configuracion` apuntaba por
error a la página de **SuperAdmin** (que exige el rol SUPERADMIN), así que
cualquier padre que entrara a Configuración era expulsado de inmediato a
`/unauthorized`. Ese era el "problema crítico en configuración de todos los
roles menos SuperAdmin" — en realidad solo afectaba a Padre, pero de forma
total (no podía ni ver Mi Perfil). Ya corregido: ahora usa la misma página
compartida que los demás roles.

## 3. Bug real en Storage: la policy de "vouchers" apuntaba a otro bucket
En `docs/SUPABASE_STORAGE_SETUP.sql` la policy de lectura/escritura decía
`bucket_id = 'vales'`, pero el bucket que realmente usa el sistema (y tu
`.env`) se llama `vouchers`. Esto podía estar bloqueando la subida de
comprobantes de pago. Ya corregido — **tienes que volver a correr ese SQL
completo** para que la policy se actualice.

## 4. Admin ahora tiene Pagos y Permisos de Salida en el menú
Antes solo Secretaría y Director los tenían. Como el administrador de un
colegio privado también necesita ver/gestionar pensiones y permisos, agregué
`/admin/pagos` y `/admin/permisos` al sidebar de Administrador, y
`/director/permisos` al de Director (usan los mismos componentes, no hay
duplicación de código).

## 5. Datos de pago (Yape/Plin/Banco) configurables
Nuevos campos en Configuración → Institución → "Datos para el pago de
pensiones": número Yape, titular, número Plin, titular, banco, cuenta y CCI.
El padre los ve automáticamente en su página de Pagos, en una tarjeta
"¿Dónde pagar?".

## 6. QR — horario configurable (aclaración)
El código para configurar Hora de entrada / Tardanza / Salida en
Configuración → Institución ya estaba en el paquete de la ronda anterior.
Con este paquete completo ya no debería faltar. La pantalla de QR en sí
(imagen 4 que enviaste) nunca mostró esos campos — eso es correcto, están en
Configuración, no en la pantalla del escáner.

## 7. Permisos de Salida — ajustado al flujo que pediste
Flujo actualizado para que coincida con tu diagrama (Docente solicita →
Secretaría revisa/llama al padre → Autoriza Sí/No → si Sí, **Director**
aprueba → se registra en auditoría → Alumno Sale):
- El paso final "Marcar Salida" (que efectivamente saca al alumno) ahora
  **solo lo puede hacer Director, Administrador o SuperAdmin** — Secretaría
  ya no puede ejecutarlo directamente, ve el mensaje "Esperando aprobación
  final de Dirección".
- Ese paso final ahora queda registrado en Auditoría (antes no se
  auditaba).
- Secretaría sigue validando la solicitud, registrando la llamada al padre
  (ya existía ese campo) y autorizando/denegando — eso no cambió.
- Agregué "Nuevo Permiso" para que Secretaría también pueda iniciar uno
  (ronda anterior).

## 8. Pagos — ahora sí muestra "cuánto debe" automáticamente
Esto era lo más grande. Implementé el plan de pensiones configurable que
pediste:

- En **Conceptos de pago** (Secretaría/Admin → Pagos → "Conceptos de pago"),
  cada concepto ahora define:
  - **Nivel**: Inicial / Primaria / Secundaria / Todos los niveles.
  - **Meses en que se cobra**: botones para marcar los meses (por defecto
    marzo-diciembre, el año escolar típico).
- Cuando un **padre entra a su página de Pagos**, el sistema genera
  automáticamente — sin que Secretaría tenga que hacer nada — el cargo
  pendiente de cada mes ya transcurrido que le corresponda según el nivel de
  su(s) hijo(s). Ejemplo: si es agosto y la pensión de Primaria (S/ 350) se
  cobra de marzo a diciembre, un padre con un hijo en Primaria verá 6 cargos
  pendientes (marzo a agosto) apenas entre, cada uno con su mes bien
  legible ("Marzo 2026", no "2026-03") y el total a deber sumado arriba.
  Cada uno tiene su botón "Subir voucher" individual.
- El botón manual "Generar cargo del mes" de Secretaría se mantiene como
  respaldo/atajo (por ejemplo, para un concepto especial de un solo mes como
  "Materiales 2026"), pero ya no es indispensable para el flujo normal de
  pensiones.

**Nota:** para que esto funcione, primero tienes que crear el concepto
"Pensión" (o el nombre que uses) desde el botón "Conceptos de pago", con su
monto, nivel y meses — una sola vez por cada nivel/monto distinto. Después
todo es automático.

---

## Resumen de todos los archivos nuevos en esta ronda
- `sige/prisma/migrations_manual/v8.11_pagos_yape_plin_plan.sql`
- `sige/src/routes/conceptosPago.ts` (si no lo tenías de la ronda anterior)
- `sige-frontend/app/(dashboard)/admin/pagos/page.tsx`
- `sige-frontend/app/(dashboard)/admin/permisos/page.tsx`
- `sige-frontend/app/(dashboard)/director/permisos/page.tsx`

Todo lo demás son archivos que ya existían, modificados.
