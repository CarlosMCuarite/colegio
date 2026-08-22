# SIGE v8.13 — Paquete COMPLETO

Igual que el paquete anterior: trae las carpetas `sige/` y `sige-frontend/`
completas (sin `.env` ni `node_modules`), con todo lo acumulado de esta
sesión. Reemplaza tus carpetas completas (respalda tu `.env` de cada una
antes).

## Pasos para levantar todo desde cero

```bash
cd sige
npm install
npx prisma generate
```

Corre estos 4 SQL en el SQL Editor de Supabase **en este orden** (si ya
corriste alguno antes, sáltatelo):
1. `prisma/migrations_manual/v8.10_horario_asistencia.sql`
2. `prisma/migrations_manual/v8.11_pagos_yape_plin_plan.sql`
3. `prisma/migrations_manual/v8.12_pagos_por_estudiante.sql`
4. `prisma/migrations_manual/v8.13_perfil_direccion.sql` (nuevo)

Y vuelve a correr `docs/SUPABASE_STORAGE_SETUP.sql` completo (por el fix de
la policy de `vouchers`).

```bash
npm run dev        # backend
```

```bash
cd sige-frontend
npm install         # instala el paquete nuevo "qrcode" (para el carnet)
npm run dev
```

Cierra sesión y vuelve a entrar en el navegador (o Ctrl+Shift+R) antes de
probar.

---

## Todo lo corregido/agregado en esta ronda

**Bugs críticos:**
1. **Voucher "Bucket not found"** — el bucket es privado a propósito; ahora
   se genera una URL firmada (5 min) al hacer clic en "Ver", tanto para
   Secretaría/Admin como para el Padre.
2. **Backups fallando sin explicación** — ahora se muestra el error real
   debajo del estado "Fallido".
3. **Asistencia del padre en blanco** — agregados estados de carga/vacío/error.
4. **Fecha de eventos corrida un día** (8/8 se guardaba como 7/8) — era un
   bug de zona horaria (UTC vs. hora local de Perú), corregido. "Fecha Fin"
   también se autocompleta ahora.

**Pagos:**
5. Búsqueda por padre/hijo/DNI, filtro por mes, tarjetas de resumen (Por
   cobrar / En revisión / Cobrado) y paginación — pensado para manejar los
   ~1800 alumnos sin que la lista se vuelva inmanejable.

**Padre:**
6. Horarios ahora tiene vista de Tabla (por defecto) además de Lista.

**Secretaría:**
7. Dashboard con gráficos: asistencia de los últimos 7 días (área) y pagos
   por estado (dona) — mismo estilo que ya tenía el dashboard de Admin.

**Carnet de estudiante (nuevo):**
8. Botón "Generar carnet" en la lista de Estudiantes (Secretaría y Admin).
   Muestra foto, nombre, DNI, grado/sección, y un código QR generado a
   partir del mismo `codigoQR` que el estudiante ya usa para el escáner de
   asistencia — el carnet impreso funciona directo como pase de ingreso.
   Botón "Imprimir carnet" con diseño listo para tarjeta.

**Configuración — más completa para todos los roles:**
9. Agregué DNI y Dirección a "Mi Perfil" (antes solo tenía nombres,
   apellidos, teléfono). Para Padre, estos datos también se sincronizan con
   su ficha de padre de familia usada en matrículas/pagos/permisos.
10. Simplifiqué la página de Admin: ahora son 2 pestañas (Institución / Mi
    Cuenta), y "Mi Cuenta" usa el mismo componente compartido que
    Secretaría/Docente/Padre — se eliminó código duplicado.

## Archivos nuevos en esta ronda
- `sige/prisma/migrations_manual/v8.13_perfil_direccion.sql`
- `sige-frontend/components/CarnetEstudiante.tsx`

## Nota
El campo "pen" que viste en Pagos de prueba no es un bug — es el nombre
literal que se le puso al concepto de prueba. Créalo como "Pensión mensual"
y se verá bien.
