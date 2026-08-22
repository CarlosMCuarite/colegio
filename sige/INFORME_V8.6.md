# INFORME DE CAMBIOS — SIGE v8.6

---

## 1. Logout — causa raíz real encontrada (por fin)

Este bug se reportó repetidamente en versiones anteriores y el código de
`logout()` siempre se veía correcto en cada revisión. La causa real no
estaba en `logout()` en sí, sino en que **nunca se refrescaba** la sesión
cacheada:

**Diagnóstico:** `AuthProvider` cargaba el usuario directamente desde el
`localStorage` guardado (`JSON.parse(sige-user)`) y confiaba en ese dato para
siempre. Si esa sesión se guardó en el navegador **antes** de que el sistema
empezara a guardar el `slug` del colegio (versiones anteriores a v8.2), el
objeto cacheado nunca tuvo ese dato — y como el propio `logout()` depende de
leer `usuario.colegio.slug` para saber a dónde redirigir, una sesión vieja
quedaba atrapada para siempre: no había forma de "arreglarlo" cerrando
sesión, porque cerrar sesión era exactamente lo que estaba roto.

**Corrección:** al montar la aplicación, además de leer el `localStorage`,
ahora se hace una llamada en segundo plano a `GET /auth/me` que trae los
datos frescos del usuario (incluido `colegio.slug`) y actualiza tanto el
estado en memoria como el `localStorage`. Así, cualquier sesión vieja se
autorepara con solo recargar la página, sin necesidad de un logout/login
manual que antes era imposible completar correctamente.

**Archivo:** `lib/auth.tsx`

**Para ti en este momento:** si sigues en una sesión abierta desde antes de
este cambio, simplemente **recarga la página una vez** (F5) estando dentro
del sistema — eso disparará la resincronización y el próximo cierre de
sesión ya te llevará a `/colegio/encinas/login` correctamente.

---

## 2. Exportaciones — corregido según lo que realmente pediste

Entendí mal el pedido en la versión anterior: agregué un botón "Ver" junto a
cada módulo antes de exportar, cuando lo que pediste era poder **cargar el
archivo ya descargado** para revisarlo.

**Corregido por completo:**
- Se eliminó el botón "Ver" por módulo (y su endpoint `POST
  /exportaciones/vista-previa`, que ya no se usa).
- Nueva sección **"Visualizar un archivo exportado"**: puedes arrastrar o
  seleccionar el archivo `.zip` que descargaste anteriormente. El sistema lo
  abre **en el navegador** (sin subir nada a ningún servidor), muestra cada
  archivo JSON que contiene, y con un clic en "Ver contenido" lo despliega en
  el visor de árbol (buscar, expandir/colapsar, copiar, descargar) que ya
  tenías desde v8.4.
- Se agregó la librería `jszip` (liviana, sin dependencias, estándar de la
  industria para esto) para poder leer el ZIP directamente en el navegador.
- Se explicita en pantalla el objetivo real: exportar y luego poder borrar
  los registros antiguos del módulo correspondiente para aliviar la base de
  datos, con la garantía de poder revisar cualquier exportación pasada antes
  de decidir borrar algo.

**Archivos:** `app/(dashboard)/admin/exportaciones/page.tsx` (reescrita),
`src/routes/exportaciones.ts`, `package.json` (nueva dependencia `jszip`)

---

## 3. SuperAdmin — Backups agregado (dato y archivos)

**Encontrado un problema de infraestructura serio al revisar esto:** ya
existía un servicio de backup automático (corría cada hora), pero escribía
los archivos a **disco local del servidor** — en Render (y la mayoría de
plataformas de hosting), el disco se borra completamente en cada reinicio o
redeploy. Es decir, **los backups se estaban perdiendo silenciosamente**
sin que nadie lo notara, porque no había ninguna pantalla para verlos ni
descargarlos tampoco.

**Corregido de raíz:**
- El servicio ahora sube cada backup a **Supabase Storage** (bucket privado
  `backups`, no público, solo accesible por el backend), que es persistente
  de verdad.
- El backup ahora incluye más módulos que antes: estudiantes, padres,
  matrículas, asistencias, pagos, comunicados, documentos, eventos,
  encuestas, horarios y usuarios — antes solo cubría los primeros cinco.
- Sobre "los archivos subidos" (logos, documentos, fotos, vouchers): esos ya
  viven de forma duradera en Supabase Storage independientemente de este
  backup — lo que se respalda son las URLs y metadatos que apuntan a ellos
  (ya incluidos en los registros de cada módulo), que es lo que realmente
  se puede perder si la base de datos falla. Los archivos binarios en sí no
  se duplican porque Storage ya es su respaldo natural.
- Nueva pantalla en el menú del SuperAdmin: **Backups** — dispara un
  respaldo manual (de un colegio o de todos los activos), lista el
  historial con estado y tamaño, permite descargar (enlace temporal de 5
  minutos, por seguridad) o eliminar versiones antiguas.
- Rotación automática: se conservan las últimas 7 versiones por colegio,
  igual que antes, pero ahora sí persisten de verdad entre reinicios.

**Archivos:** `src/services/backupService.ts` (reescrito),
`src/routes/backups.ts` (nuevo), `src/config/supabase.ts`, `src/index.ts`,
`app/(dashboard)/superadmin/backups/page.tsx` (nueva),
`components/layout/Sidebar.tsx`, `docs/SUPABASE_STORAGE_SETUP.sql`

**Acción requerida:** ejecutar de nuevo `docs/SUPABASE_STORAGE_SETUP.sql` en
el SQL Editor de Supabase — agrega el bucket privado `backups` que no
existía.

---

## 4. Horarios — causa raíz real del aula "sin asignar"

**No era un bug de Horarios.** Rastreando el problema hasta el origen, el
formulario de Horarios sí envía correctamente el aula elegida — el problema
real está en el módulo de **Aulas**, reportado como roto desde v8.4 y nunca
corregido a fondo hasta ahora:

**Causa raíz encontrada:** en `PATCH /aulas/:id` (el endpoint para editar
una aula existente), el validador de datos **no incluía el campo
`seccionId`**. Zod, por defecto, descarta silenciosamente cualquier campo
que reciba pero no esté en su lista de campos esperados — así que cada vez
que editabas un aula para asignarle una sección, el sistema respondía
"aula actualizada" (mentira útil, pero mentira), y la sección nunca se
guardaba. Con el tiempo, esto significa que muy probablemente **no existían
aulas con sección correctamente asignada** — por eso el selector de aula en
Horarios aparecía vacío o forzaba "sin asignar": no había nada válido para
elegir.

**Corrección:** se agregó `seccionId` al validador de `PATCH /aulas/:id`.
Editar una aula ahora sí guarda su sección correctamente. También se
endureció la validación de `capacidad` en los tres endpoints de Aulas
(crear aula, editar aula, crear sección) para aceptar el valor tal como lo
envía el formulario sin rechazarlo por tipo.

**Qué hacer ahora:** entra a Aulas, edita (o crea) tus aulas asignándoles su
sección correspondiente — ahora sí quedará guardado — y luego el selector de
aula en Horarios mostrará opciones reales para elegir.

**Archivo:** `src/routes/aulas.ts`

---

## 5. Horarios — vista de tabla semanal (como pediste en la imagen)

Se agregó exactamente el formato que mostraste: una tabla con las horas
como filas y los días de la semana como columnas, cada curso pintado con un
color distinto, mostrando materia, docente y aula en cada celda.

- Botón para alternar entre **"Vista de tabla"** (nueva, por defecto) y
  **"Vista de lista"** (la que ya existía).
- Botón **"Imprimir / Descargar"** que abre el diálogo de impresión del
  navegador mostrando *solo* la tabla (todo lo demás de la pantalla se
  oculta automáticamente al imprimir) — desde ahí se puede imprimir en papel
  o guardar como PDF, que es la forma más simple y compatible de
  "descargarlo" sin depender de generar un archivo especial en el servidor.
- Las filas se arman automáticamente según los horarios ya creados (no hay
  que definir bloques de hora por separado) y las columnas solo muestran los
  días que realmente tengan clases asignadas.
- El color de cada curso es estable (el mismo curso siempre sale del mismo
  color) para que sea fácil de leer de un vistazo, igual que en tu ejemplo.

**Archivos:** `components/HorarioGrid.tsx` (nuevo),
`app/(dashboard)/admin/horarios/page.tsx`, `app/globals.css`

---

## 6. Comunicados — ver documento e información completa

Se agregó el botón "Ver" (ícono de ojo) en cada comunicado de la lista, que
abre una ventana con:
- Título, quién lo publicó y cuándo.
- A quién está dirigido (todo el colegio, o nivel/grado/sección específico)
  y fecha de vencimiento si tiene.
- El contenido completo del mensaje (en la lista solo se veían 2 líneas).
- El documento adjunto, mostrado directamente en pantalla si es una imagen
  o un PDF (sin necesidad de descargarlo para verlo), o con un botón claro
  de "Abrir / Descargar" para otros tipos de archivo.

**Archivo:** `app/(dashboard)/secretaria/comunicados/page.tsx`

---

## Resumen de archivos modificados

**Backend:**
`src/services/backupService.ts` (reescrito), `src/routes/backups.ts` (nuevo),
`src/routes/aulas.ts`, `src/routes/exportaciones.ts`, `src/config/supabase.ts`,
`src/index.ts`, `docs/SUPABASE_STORAGE_SETUP.sql`

**Frontend:**
`lib/auth.tsx`, `components/HorarioGrid.tsx` (nuevo),
`components/layout/Sidebar.tsx`,
`app/(dashboard)/admin/exportaciones/page.tsx` (reescrita),
`app/(dashboard)/admin/horarios/page.tsx`,
`app/(dashboard)/superadmin/backups/page.tsx` (nueva),
`app/(dashboard)/secretaria/comunicados/page.tsx`,
`app/globals.css`, `package.json` (+jszip)

## Acciones requeridas antes de probar
1. `npm install` en `sige-frontend` (nueva dependencia `jszip`).
2. Ejecutar `docs/SUPABASE_STORAGE_SETUP.sql` en Supabase (crea el bucket
   privado `backups`).
3. Si sigues con una sesión abierta desde antes de este cambio, recarga la
   página una vez para que se autorepare (ver punto 1).
4. Entra a Aulas y verifica/reasigna la sección de tus aulas existentes —
   antes no se guardaba aunque pareciera exitoso.

## Migraciones de base de datos
Ninguna. Los modelos `Backup` y `BackupEstado` ya existían en el schema; solo
se corrigió el servicio que los usa y se expuso vía API/UI.

## Pruebas recomendadas
1. Cerrar sesión desde el panel de Encinas y confirmar que vuelve a
   `/colegio/encinas/login`.
2. Exportar un módulo, descargar el ZIP, y volver a cargarlo en la nueva
   sección de "Visualizar un archivo exportado" para confirmar que se ve el
   contenido.
3. Generar un backup manual desde SuperAdmin → Backups y descargarlo.
4. Editar un aula asignándole una sección, y confirmar (recargando la
   página) que la sección quedó guardada.
5. Crear un horario seleccionando esa aula y confirmar que se guarda
   correctamente.
6. Ver la tabla semanal de horarios e imprimirla.
7. Abrir el detalle de un comunicado con documento adjunto.
