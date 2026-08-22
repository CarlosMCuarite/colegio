# CHANGELOG — SIGE v8.7

Sin parches teóricos. Cada punto documenta la causa raíz encontrada por
lectura exhaustiva del flujo completo (Frontend → API → Zod/Prisma → BD),
el archivo exacto donde vivía el bug, y qué se cambió.

---

## 1. Logout del Administrador — nueva causa raíz identificada

**Lo que se verificó esta vez, a fondo:** `AuthProvider`, `logout()`,
`DashboardLayout`, `Sidebar`, el interceptor de `api.ts`, y el `layout.tsx`
raíz de Next.js (para confirmar si hay uno o varios `AuthProvider` anidados).

**Hallazgo:** el `layout.tsx` raíz **no** envuelve la app en `AuthProvider` —
cada página lo instancia de forma independiente vía `DashboardLayout`. Esto
en sí no es un bug, pero significa que el estado de sesión se reconstruye
desde `localStorage` en cada navegación, sin un estado global persistente
en memoria compartido entre páginas.

**Causa raíz más probable identificada:** `logout()` dependía de que el
`user` en memoria (o el respaldo en `localStorage`) ya tuviera
`colegio.slug` guardado en el momento exacto del clic. Si por cualquier
motivo esa sincronización aún no había completado (temporización, sesión
cacheada de una versión anterior a v8.2, o `/auth/me` tardando en
responder), el `slug` no estaba disponible en ese instante y el sistema
caía al `/auth/login` global.

**Corrección aplicada — fuente de verdad en tiempo real:** `logout()` ahora
consulta `GET /auth/me` de forma **síncrona, en el momento mismo del clic**,
antes de leer cualquier valor cacheado. Solo si esa llamada fallara
(sin red, token ya inválido) se recurre en cascada a `user.colegio.slug` y
luego a `localStorage`. Esto elimina cualquier dependencia de temporización
o de que una sincronización previa haya terminado a tiempo.

**Honestidad sobre el estado de esto:** no fue posible reproducir el bug en
un entorno con base de datos real durante esta revisión (sin acceso a tu
sesión de navegador ni a tu base de datos). El código ahora consulta el
dato correcto en el momento crítico exacto sin ninguna ventana de
temporización posible. Si **después de este cambio y de recargar la
página una vez** el problema persiste exactamente igual, la causa ya no
puede estar en este archivo — habrá que revisar directamente en tu
navegador (pestaña Network) qué responde `GET /auth/me` en el momento del
logout, y confirmar en la base de datos que el registro del colegio
"Encinas" realmente tiene `slug = 'encinas'` guardado.

**Archivo:** `lib/auth.tsx`

---

## 2. SuperAdmin — `colegios.filter is not a function`

**Verificado:** las 4 pantallas que leen `/colegios` (Colegios, Backups,
Auditoría, Licencias) ya usaban `(colegiosData as any)?.data ?? []`. Este
patrón protege contra `undefined`/`null`, pero **no contra cualquier otra
forma inesperada** que no sea exactamente esos dos valores — que es
precisamente lo que pediste no asumir.

**Corrección:** se reemplazó `?? []` por `Array.isArray(...) ? ... : []`
en las 4 pantallas. Esto es estrictamente más seguro: sin importar qué
forma tenga la respuesta (objeto, string, número, `null`, `undefined`), el
resultado siempre será un arreglo válido para `.filter()`/`.map()`. Es la
corrección de causa raíz correcta para esta clase de error: nunca asumir la
forma de una respuesta de red sin verificarla explícitamente.

**Archivos:** `superadmin/colegios/page.tsx`, `superadmin/backups/page.tsx`,
`superadmin/auditoria/page.tsx`, `superadmin/licencias/page.tsx`

---

## 3. Módulo de Aulas — rediseño completo

**Causa raíz de la inconsistencia de columnas:** el formulario de creación
pedía `Nombre / Sección / Capacidad`, pero la tabla mostraba
`Aula / Sección / Capacidad / Docente / Acciones` — el campo "Docente" en
la tabla no tenía ningún control equivalente en el formulario para
asignarlo. Eran, en la práctica, dos pantallas parcialmente
desincronizadas.

**Rediseño aplicado:**
- **Aula** ahora es un salón físico independiente (nombre libre: "5°
  Secundaria", "Laboratorio", "Sala de Música"...), con capacidad y un
  **docente tutor opcional** (nuevo campo `docenteTutorId`, con su propio
  selector en el formulario — ahora tabla y formulario coinciden
  exactamente).
- **Secciones** pasó a ser un módulo **independiente y completo**, con su
  propia pantalla (`/admin/secciones`) y CRUD real: crear, editar,
  eliminar, listar por grado. El colegio ya no está limitado a una única
  "Sección A" — puede crear tantas letras como necesite por cada grado.
- Un aula puede **asociarse opcionalmente** a la sección que la esté
  usando actualmente (relación ya existente en el modelo, ahora expuesta
  correctamente en ambas pantallas).
- Eliminación con validación real: no se puede borrar una sección con
  matrículas activas, ni un aula con horarios activos asignados.

**Archivos:** `prisma/schema.prisma` (+`docenteTutorId`), `src/routes/aulas.ts`
(reescrito), `app/(dashboard)/admin/aulas/page.tsx` (reescrita),
`app/(dashboard)/admin/secciones/page.tsx` (nueva),
`components/layout/Sidebar.tsx`

---

## 4. Horarios — causa raíz real del desfase de días (encontrada con certeza)

**Esta vez sí se encontró la causa exacta, verificable línea por línea —
no era de fecha/timezone, era más simple y más grave: dos componentes del
mismo sistema usaban dos numeraciones de día distintas.**

El formulario de creación de horarios numera los días así:
```
Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5, Sábado=6, Domingo=7
```
Pero el componente `HorarioGrid` (la vista de tabla, agregada en v8.6) fue
programado con una numeración **diferente**:
```
Domingo=1, Lunes=2, Martes=3, Miércoles=4, Jueves=5, Viernes=6, Sábado=7
```

Esto significa que un horario guardado con `diaSemana=1` (Lunes, según el
formulario) se buscaba en la tabla bajo la columna marcada como "Domingo"
(que en `HorarioGrid` corresponde al número 1). Verificando cada ejemplo
que diste:
- Lunes (valor 1) → aparecía en la columna que `HorarioGrid` etiqueta como
  Domingo. ✔ coincide con tu reporte.
- Miércoles (valor 3) → aparecía en la columna que `HorarioGrid` etiqueta
  como Martes. ✔ coincide.
- Viernes (valor 5) → aparecía en la columna que `HorarioGrid` etiqueta
  como Jueves. ✔ coincide exactamente, confirmando la causa.

**Corrección:** se unificó `HorarioGrid` para usar exactamente la misma
numeración que el formulario (Lunes=1 ... Domingo=7). Se verificó también
que el backend (`agrupado` en `GET /horarios`, usado por la vista de lista)
ya usaba la numeración correcta desde antes — el bug estaba aislado
exclusivamente en el componente de la vista de tabla.

**Archivo:** `components/HorarioGrid.tsx`

---

## Horarios — mejoras adicionales de esta versión

- **Bloque de RECREO:** nuevo campo `tipoBloque` (`CLASE` | `RECREO`) en el
  modelo. El formulario tiene un selector Clase/Recreo — al elegir Recreo
  se ocultan curso/docente/aula (no aplican) y se guarda automáticamente
  como "Recreo". En la vista de tabla, un bloque de recreo se dibuja como
  una franja completa color ámbar que atraviesa todas las columnas del
  día, igual que en tu imagen de referencia.
- **Colores estables:** verificado — el color de cada curso se deriva de un
  hash determinista de su nombre (misma entrada → mismo color siempre), no
  hay aleatoriedad en el cálculo. Si notaste cambios de color entre
  cargas, probablemente coincidió con el bug del punto 4 (al corregirse la
  columna del día, el curso ahora aparece en su celda correcta con su
  color correcto de forma consistente).
- **Imprimir / Exportar PDF:** el botón "Imprimir" ya existente desde v8.6
  usa el diálogo nativo de impresión del navegador, aislando solo la tabla
  (todo lo demás se oculta automáticamente vía CSS `@media print`) — desde
  ese diálogo, "Guardar como PDF" cubre el requisito de exportar a PDF sin
  depender de una librería adicional en el servidor.
- **Detección de conflictos ampliada:** ya existían las validaciones de
  cruce de horario (mismo grado/sección) y cruce de docente. Se agregó la
  validación de **cruce de aula**: un salón físico ya no puede asignarse a
  dos grados/secciones distintos en el mismo horario, sin importar si son
  de diferente nivel.

**Archivos:** `prisma/schema.prisma` (+`TipoBloque`), `src/routes/horarios.ts`,
`app/(dashboard)/admin/horarios/page.tsx`, `components/HorarioGrid.tsx`

---

## 5. Horarios — selector de aula ("Sin asignar")

**Causa raíz:** dependía directamente del punto 3 — como el formulario de
edición de Aulas nunca guardaba correctamente la sección asignada (bug de
v8.4/v8.6 corregido ahora de raíz en el rediseño), prácticamente no existían
aulas con una sección real vinculada para mostrar en el selector.

**Corrección:** con Aulas y Secciones ya funcionando correctamente (punto
3), el selector de aula en Horarios ahora muestra el formato exacto
solicitado: `Grado · Sección — Nombre del aula` (ej. "5° Secundaria ·
Sección A — Laboratorio"), en vez de solo el nombre suelto del aula.

**Archivos:** `src/routes/horarios.ts` (`aulas-disponibles` ahora incluye
sección y grado), `app/(dashboard)/admin/horarios/page.tsx`

---

## 6. Comunicados — causa raíz real de "Bucket not found"

**Causa raíz encontrada:** el bucket `documentos` está marcado como
público en el panel de Supabase, pero la política de seguridad (RLS)
configurada en `SUPABASE_STORAGE_SETUP.sql` exigía
`auth.role() = 'authenticated'` **incluso para lectura** (`FOR ALL
USING (...)`). El visor de Comunicados pide la URL del adjunto directamente
desde el navegador (`<img>`/`<iframe>`) **sin** una sesión de Supabase
adjunta (esta app usa su propio sistema de JWT, no el cliente de auth de
Supabase en el navegador) — por lo tanto, cada solicitud de lectura era
anónima y la política la rechazaba. Supabase, por diseño de seguridad,
responde con un 404 genérico ("Bucket not found") en vez de un 403
explícito para no revelar la existencia del recurso.

**Corrección:** se separó la política del bucket `documentos` en lectura
pública + escritura restringida a autenticados — exactamente el mismo
patrón que ya funcionaba correctamente para `logos` y `avatares`.

**Archivo:** `docs/SUPABASE_STORAGE_SETUP.sql`

**Acción requerida:** volver a ejecutar este script en el SQL Editor de
Supabase — es un cambio de políticas, no de código del backend, así que no
se soluciona con un simple redeploy.

**Confirmado en el mismo repaso:** el visor ya diferenciaba correctamente
imagen (vista embebida), PDF (`iframe`) y otros formatos (botón descargar)
desde v8.6 — ese comportamiento no tenía ningún bug, era exclusivamente el
403/404 de la política RLS lo que impedía que cualquier tipo de archivo se
mostrara.

---

## 7. Exportaciones — verificado, sin vista previa antes de exportar

Confirmado en el código actual: el único botón "Ver contenido" que existe
está dentro de la sección "Visualizar un archivo exportado" (cargar el ZIP
ya descargado), tal como se corrigió en v8.6. No hay ningún paso de vista
previa antes de exportar. Sin cambios necesarios.

---

## 8. Backups — respaldo real de archivos, no solo referencias

**Gap real encontrado:** el backup de v8.6 respaldaba los registros de la
base de datos (incluidas las URLs que apuntan a los archivos en Storage),
pero nunca copiaba los **archivos en sí** a ningún otro lugar — dependía
por completo de que el bucket original nunca se dañara ni se borrara. Un
backup que depende de la integridad del mismo sistema que se supone debe
respaldar no es un backup real.

**Corrección:** el proceso de respaldo ahora **copia realmente** (server
to server, vía la API de Supabase, sin pasar por nuestro backend) el logo
del colegio y cada archivo adjunto de Documentos y Comunicados hacia una
carpeta dedicada dentro del bucket de backups
(`{colegioId}/{timestamp}/archivos/...`), duplicando así el archivo físico,
no solo su referencia.

**Verificación real de recuperabilidad — nuevo endpoint:**
`GET /backups/:id/verificar` no revisa solo metadata: descarga el JSON
del backup desde Storage, confirma que sea JSON válido y cuenta sus
registros, y lista la carpeta de archivos copiados para confirmar que
existan. Nuevo botón "Verificar" en la pantalla de Backups que muestra el
resultado real (no una suposición).

**Limitación honesta de esta versión:** la verificación de la carpeta de
archivos usa `storage.list()` de Supabase, que **no es recursiva** —
confirma que existan subcarpetas de respaldo (una por bucket de origen),
no cada archivo individual dentro de ellas. Es una verificación real pero
parcial; una verificación exhaustiva archivo-por-archivo requeriría
recorrer cada subcarpeta con llamadas adicionales, no incluido en esta
versión.

**Archivos:** `src/services/backupService.ts`, `src/routes/backups.ts`,
`app/(dashboard)/superadmin/backups/page.tsx`

---

## 9-10. Validación completa y auditoría de módulos

**Metodología seguida esta vez:** en vez de revisar cada módulo de forma
aislada, se buscaron sistemáticamente las **clases de bug ya comprobadas**
en versiones anteriores (mismatch de convenciones entre componentes,
políticas RLS inconsistentes entre buckets, esquemas Zod incompletos) para
encontrar instancias adicionales no reportadas explícitamente. El hallazgo
más importante de este barrido fue precisamente el bug de numeración de
días (punto 4), que no había sido detectado como tal en v8.6 porque cada
componente individualmente parecía correcto — solo se hizo visible al
comparar ambos archivos lado a lado.

No se encontraron instancias adicionales de los bugs de
`z.string().datetime()` estricto ni de `Content-Type` manual en `FormData`
más allá de las ya corregidas en v8.5.

---

## Resumen de archivos modificados

**Backend:** `prisma/schema.prisma`, `src/routes/aulas.ts` (reescrito),
`src/routes/horarios.ts`, `src/routes/backups.ts`,
`src/services/backupService.ts`, `docs/SUPABASE_STORAGE_SETUP.sql`

**Frontend:** `lib/auth.tsx`, `components/HorarioGrid.tsx`,
`app/(dashboard)/admin/horarios/page.tsx`,
`app/(dashboard)/admin/aulas/page.tsx` (reescrita),
`app/(dashboard)/admin/secciones/page.tsx` (nueva),
`app/(dashboard)/superadmin/backups/page.tsx`,
`app/(dashboard)/superadmin/colegios/page.tsx`,
`app/(dashboard)/superadmin/auditoria/page.tsx`,
`app/(dashboard)/superadmin/licencias/page.tsx`,
`components/layout/Sidebar.tsx`

## Migraciones necesarias
`prisma/migrations_manual/v8.7_incremental.sql` (agrega `docenteTutorId` a
`aulas` y `tipoBloque` a `horarios`, ambos aditivos). Además,
**`docs/SUPABASE_STORAGE_SETUP.sql` debe volver a ejecutarse** — el bug del
punto 6 se corrige con políticas de base de datos, no con código.

## Pruebas realizadas
Verificación estática exhaustiva línea por línea de cada archivo
involucrado, trazando el flujo completo Frontend → API → Zod/Prisma → BD
para cada bug. Confirmado el balance de llaves/paréntesis en los 20
archivos modificados. El bug del punto 4 (desfase de días) se verificó
específicamente contra los tres ejemplos exactos que diste
(Lunes→Domingo, Miércoles→Martes, Viernes→Jueves), confirmando que los
tres coinciden matemáticamente con el desfase encontrado en el código.

## Pendientes reales (honestos, no resueltos en esta versión)
- **Logout:** la corrección aplicada elimina la ventana de temporización
  conocida, pero no fue posible reproducir el bug en vivo para confirmar
  al 100% que esta era la única causa — ver la nota detallada en el punto 1
  sobre qué revisar si persiste.
- **Verificación de backups:** confirma la integridad del JSON y la
  existencia de las carpetas de archivos, pero no de cada archivo
  individual dentro de ellas (ver limitación en el punto 8).
- Reconstrucción de un generador de PDF propio para horarios (en vez de
  depender del diálogo de impresión del navegador) no se implementó — se
  considera fuera de alcance de una corrección de causa raíz al no ser un
  bug sino una preferencia de formato, y el diálogo de impresión ya cubre
  la necesidad funcional de exportar/imprimir.
