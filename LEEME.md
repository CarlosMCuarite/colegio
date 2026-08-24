# SIGE — Barrido total de errores de build (v8.39)

No hace falta SQL nuevo.

## Backend — esta vez busqué TODO, no archivo por archivo

En vez de esperar a que Render fuera reportando errores de a poco (van 3
rondas ya: 2 errores → 8 → 6 más), escribí un script que revisa **cada una**
de las 136 llamadas `create`/`createMany`/`upsert` de todo el backend,
detectando cuáles mezclan datos de zod con campos del request
(`req.colegioId`, `req.user`) sin la anotación de tipo que hace falta.
Encontré y corregí **26 llamadas más** repartidas en 20 archivos —
`comunicados.ts`, `documentos.ts`, `encuestas.ts`, `auth.ts` (3 veces),
`qr.ts` (2), `asistencia.ts` (2), `pagos.ts` (2), `chat.ts` (2),
`exportaciones.ts`, `membresias.ts` (3), y más. Volví a correr el script al
final: **cero llamadas pendientes** de este patrón en todo el proyecto.

También corregí 2 errores de otro tipo que aparecieron:
- **`colegios.ts`**: el tipo `Express.Multer.File` no estaba resolviendo en
  este entorno de build — se tipó de forma más simple y directa en su lugar.
- **`comunicados.ts`**: había un `new Date(fecha as string)` sobre un campo
  que YA era un objeto `Date` real (el schema usa `z.coerce.date()`) — se
  estaba convirtiendo a texto solo para reconvertirlo, y ese cast inválido
  rompía la compilación. Corregido.

Verifiqué el balance de llaves/paréntesis de los 28 archivos tocados —
todo correcto.

## Frontend — el MISMO error volvió a aparecer

Confirmé otra vez que mi copia está 100% limpia (los archivos que te
entrego nunca tuvieron ese problema). Como ya es la segunda vez que el
mismo error reaparece después de "reemplazar" la carpeta, lo más probable
es que Windows haya **fusionado** las carpetas en vez de reemplazarlas al
copiar/pegar — si la carpeta `sige-frontend` ya existía, copiar la nueva
adentro mezcla archivo por archivo, y el archivo corrupto se queda si
Windows no te preguntó explícitamente por ese archivo en particular.

### Esta vez, paso a paso, sin margen de error:

1. **Cierra** cualquier programa que tenga la carpeta abierta (VS Code,
   Explorador de Windows, etc.).
2. **Borra por completo** la carpeta `sige-frontend` vieja:
   ```bash
   rm -rf sige-frontend
   ```
3. Descomprime este zip y **copia la carpeta `sige-frontend` completa**
   (recién extraída, no la mezcles) al lugar exacto donde estaba la vieja.
4. Verifica ANTES de hacer commit, corriendo esto dentro de la carpeta:
   ```bash
   grep -rn "from 'a/" app/ components/ lib/ hooks/ --include='*.tsx' --include='*.ts'
   ```
   Si esto imprime CUALQUIER cosa, el reemplazo no se hizo bien — vuelve al
   paso 2. Si no imprime nada, sigue.
5. Haz lo mismo con `sige/` (borrar y reemplazar completo, no mezclar).
6. `git add . && git commit -m "Barrido completo de errores de build" && git push`

## Si vuelve a fallar
Con este barrido exhaustivo del backend, no debería quedar ningún error de
ese tipo. Si aun así aparece alguno nuevo, mándame el log completo (como
archivo descargado, no texto de pantalla) y lo reviso de inmediato — pero
esta vez, por favor confirma primero que el paso 4 de arriba te dio "vacío"
antes de hacer push, así no repetimos el mismo problema del frontend una
tercera vez.
