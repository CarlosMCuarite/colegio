# SIGE — Segunda pasada de arreglos de build (v8.38)

No hace falta SQL nuevo. Todo esto es código, para que el build de
producción compile limpio.

## Backend — causa raíz encontrada y corregida en 15 archivos

El patrón exacto: `prisma.X.create({ data: { ...data, campoExtra } })` —
combinar el spread de un objeto validado por zod con campos adicionales
explícitos en el MISMO literal rompe la inferencia de tipos de Prisma
cuando se compila con `tsc` en modo estricto de producción (nunca se veía
en local porque siempre se corre con `ts-node`, más permisivo).

Hice una búsqueda exhaustiva de este patrón en **todo** `src/routes/` y
`src/seed*.ts` (no until until que Render fuera encontrando uno por uno) y
corregí los 15 archivos donde aparecía:

`estudiantes.ts` · `eventos.ts` · `horarios.ts` (3 veces) · `matriculas.ts`
· `membresias.ts` · `notas.ts` · `observaciones.ts` · `padres.ts` ·
`aulas.ts` · `chatbot.ts` · `conceptosPago.ts` · `cursos.ts` ·
`plataforma.ts` · `pagosLicencia.ts` · `permisosSalida.ts` · los 3 scripts
de semilla.

La corrección es la misma en todos: se anota explícitamente el tipo
(`as Prisma.XUncheckedCreateInput`) para que TypeScript sepa contra cuál
variante del tipo de Prisma debe validar, en vez de intentar adivinarlo y
fallar. Verifiqué el balance de llaves de los 18 archivos tocados — todo
correcto.

## Frontend — la corrupción de imports seguía ahí (en más archivos)

Encontré que `admin/auditoria/page.tsx` y `admin/aulas/page.tsx` en tu
copia local TODAVÍA tenían imports rotos, distintos a los de la vez
pasada — confirmé que en los archivos que te entrego están perfectamente
bien. Como esto ya pasó dos veces en archivos distintos, **no vamos a
seguir parchando línea por línea** — hice una verificación automática de
los 222 imports `@/...` de todo el frontend contra el sistema de archivos
real, y confirmé que los 222 apuntan a un archivo que sí existe. Cero
rotos.

## Qué hacer ahora — reemplaza, no parches

Para evitar que se cuele otra corrupción suelta:

1. **Borra por completo** tus carpetas locales `sige/` y `sige-frontend/`
   (no las sobreescribas archivo por archivo).
2. Copia las de este zip en su lugar.
3. Antes de subir, verifica que quedó limpio corriendo esto DENTRO de
   `sige-frontend/`:
   ```bash
   grep -rn "from 'a/" app/ components/ lib/ hooks/ --include='*.tsx' --include='*.ts'
   ```
   Si no imprime nada, estás limpio.
4. `git add . && git commit -m "Corrige todos los errores de build" && git push`
5. Render debería redesplegar solo.

## Si vuelve a fallar
Esta vez cópiame el log **completo, de principio a fin**, sin cortar
(puedes descargarlo como archivo desde el botón de opciones junto a "Live
tail" en Render, en vez de copiar el texto de la pantalla) — así reviso
todo de una sola vez y no vamos arreglando de a poco según lo que Render
vaya reportando por partes.
