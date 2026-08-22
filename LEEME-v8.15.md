# SIGE v8.15 — Paquete COMPLETO

Reemplaza tus carpetas `sige/` y `sige-frontend/` completas (respalda tu
`.env` de cada una antes de reemplazar).

## Pasos para levantar todo

```bash
cd sige
npm install
npx prisma generate      # con el backend DETENIDO
```

Corre estos SQL en Supabase, **en este orden** (sáltate los que ya corriste
antes):
1. `v8.10_horario_asistencia.sql`
2. `v8.11_pagos_yape_plin_plan.sql`
3. `v8.12_pagos_por_estudiante.sql`
4. `v8.13_perfil_direccion.sql`
5. **`v8.14_disable_rls_tablas_app.sql`** (nuevo — arregla el error de backups)
6. **`v8.15_facturacion_saas.sql`** (nuevo — tablas de facturación del SaaS)

```bash
npm run dev               # backend
```
```bash
cd sige-frontend
npm install
npm run dev
```

Cierra sesión y vuelve a entrar (o Ctrl+Shift+R) antes de probar.

---

## Bugs corregidos en esta ronda

1. **Backups fallando con "row-level security policy"** — en algún momento
   se activó RLS en las tablas de la aplicación (posiblemente al usar el
   Table Editor de Supabase). Como el backend solo usa Prisma con conexión
   directa (no pasa por RLS de Supabase normalmente), esto no debería estar
   activo. La migración `v8.14` lo desactiva en todas tus tablas.

2. **Horario del padre mostraba el grado equivocado** — el endpoint
   `GET /horarios` **no filtraba nada** para el rol Padre (devolvía TODOS
   los horarios del colegio sin distinción). Ahora filtra estrictamente por
   la matrícula activa de sus propios hijos.

3. **"Demasiadas solicitudes" en cadena en Eventos (padre)** — encontré la
   causa exacta: `new Date().toISOString()` se llamaba directo en cada
   render, generando una URL distinta cada vez → SWR lo trataba como un
   recurso nuevo → pedía de nuevo sin parar → bucle infinito de peticiones.
   Esto también explicaba por qué los eventos no aparecían (las peticiones
   nunca llegaban a completarse bien). Corregido con `useMemo`.

4. **Rate limiter demasiado estricto** — 300 peticiones/15min por IP es muy
   poco cuando varios dispositivos del colegio comparten la misma IP
   pública y la pantalla QR sondea cada 10s todo el día. Subido a
   3000/15min, y `/qr/sesion` ya no cuenta contra el límite. El escaneo QR
   tiene su propio límite más generoso (120/min) para cuando hay fila de
   alumnos.

5. **QR de asistencia — escaneo repetido sin control** — si alguien
   mantenía el carné frente a la cámara, cada frame decodificado disparaba
   una petición nueva (docenas por segundo). Ahora se ignora el mismo
   código si se leyó hace menos de 8 segundos. También: el resultado se
   limpia solo a los 4 segundos (para no confundir al siguiente alumno), se
   afinó la cámara (fps 15, caja más chica) para reconocer más rápido, y los
   errores de red ya no se apilan (mismo toast se actualiza en vez de
   sumar uno nuevo por cada intento fallido).

6. **Ver voucher abría pestaña nueva** — ahora abre un modal, tanto en
   Secretaría/Admin como en Padre y en la nueva sección de Facturación.

7. **Columna Acciones de Pagos desordenada** — ancho mínimo fijo y
   alineación consistente para que no se vea "saltado" entre filas con
   distinta cantidad de botones.

## Facturación del SaaS (nuevo)

Tenías razón: el dashboard de Superadmin usaba datos de pensiones de UN
colegio de prueba, que no tiene sentido a nivel plataforma. Ahora:

- **`/superadmin/facturacion`** — Superadmin configura sus propios datos de
  cobro (Yape/Plin/Banco) y revisa/aprueba/rechaza los pagos de suscripción
  que suben los colegios. Al aprobar, la licencia del colegio se extiende
  30 días automáticamente.
- **`/admin/facturacion`** — el admin/director del colegio ve el estado de
  su licencia (al día / por vencer / vencida), dónde pagar, y sube su
  voucher de pago.
- **Dashboard de Superadmin rediseñado**: tarjetas de Colegios / Licencias
  activas / Ingresos por suscripción / Usuarios / MRR (en vez de
  pensiones), gráfico de Crecimiento (matrículas) + Ingresos mensuales
  lado a lado, y un **Centro de alertas** con licencias vencidas/por
  vencer, pagos pendientes de revisión, y backups fallidos — cada uno con
  enlace directo a donde corresponde resolverlo.

**Nota de alcance**: no alcancé a construir una página separada de
"Monitoreo del sistema" dedicada — el Centro de alertas ya cubre lo más
urgente (backups, licencias, pagos pendientes) directamente en el
dashboard. Si quieres una vista de monitoreo más completa (uptime, latencia
de API, errores recientes, etc.), lo puedo armar en la próxima ronda.

## Carnet de estudiante

- **El padre ahora puede subir la foto de su hijo** directamente desde su
  panel (clic en el avatar del hijo, en "Mi Panel Familiar") — antes solo
  el personal podía. Secretaría y Admin conservan también esa opción desde
  la lista de Estudiantes.

**Nota de alcance**: el diseño de dos caras (frente/reverso) con firma del
director, sello, código de barras, tipo de sangre, etc. como en tu
referencia, y el editor "tipo Canva" (mover texto, subir plantilla propia
por colegio) son mucho más grandes de lo que alcancé en esta ronda — el
carnet actual sigue siendo de una sola cara con diseño fijo. Si quieres,
en la próxima ronda hago primero el diseño de dos caras más fiel a tu
referencia (sin editor todavía), y dejamos el editor completo tipo Canva
como una fase aparte, porque es prácticamente una mini-aplicación por sí
sola.

## Sobre "Can't reach database server"

Ese error puntual (`aws-1-us-east-2.pooler.supabase.com:6543`) es casi
seguro un corte momentáneo de red entre tu backend y el pooler de Supabase
— no encontré nada en el código que lo cause, y como bien notaste, se
resolvió solo con reiniciar. Esto puede pasar ocasionalmente incluso en
producción con poolers gestionados; si empieza a pasar seguido, lo primero
que revisaría es el plan/región de tu proyecto Supabase y si el
`DATABASE_URL` tiene `pgbouncer=true&connection_limit=1` (ya lo tienes). No
apliqué ningún cambio de código para esto porque no hay un bug identificado
— es infraestructura, no lógica de la app.
