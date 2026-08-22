# SIGE — Arreglos para el primer deploy en Render (v8.37)

No hace falta SQL nuevo. Todo esto son correcciones de código para que el
build de producción compile — no cambia ningún comportamiento del sistema.

## Por qué recién ahora aparecieron estos errores
`npm run build` corre `tsc` (el compilador de TypeScript) sobre **todo** lo
que hay en `src/`, incluyendo los scripts de semilla — algo que nunca se
había hecho antes de este primer deploy (en local siempre se usa `ts-node`,
que es más permisivo). Por eso salieron ahora y no antes: es la primera vez
que se compila todo de forma estricta.

## Backend — 3 archivos corregidos

1. **`src/routes/pagosLicencia.ts`**: un array de dos roles usado con
   `.includes()` — TypeScript infería un tipo demasiado angosto para el
   array y rechazaba la comparación. Se anotó explícitamente como
   `RolNombre[]`.

2. **`src/routes/permisosSalida.ts`**: al crear un permiso, se usaba
   `...data` (spread) mezclado con campos adicionales en el mismo objeto —
   eso confunde a TypeScript para decidir contra cuál de las dos variantes
   del tipo de Prisma debe validar. Se cambió a listar los campos de forma
   explícita.

3. **`src/seed-demo.ts`, `seed-demo-completo.ts`, `seed-demo-academico.ts`**:
   mismo tipo de ambigüedad al crear un Padre (mezcla de `colegioId` +
   `usuarioId` + otros campos). Se anotó explícitamente el tipo
   `Prisma.PadreUncheckedCreateInput` en los 5 lugares donde aparecía.

## Frontend — revisa un archivo tuyo
En tu copia local, `app/(dashboard)/admin/aulas/page.tsx` tiene los imports
corrompidos: `'a/hooks/useApi'` y `'a/lib/api'` (les falta la `@` al
inicio). **Esto no viene de los archivos que te entregué** — confirmé que mi
copia está limpia — así que pasó en tu lado (buscar-y-reemplazar accidental
o similar). Para no perseguir corrupciones sueltas, mejor te vuelvo a
entregar `sige-frontend/` completo — reemplaza tu carpeta entera con esta y
asegúrate de tener el `@` correctamente en todos los imports.

## Qué hacer ahora
1. Reemplaza tus carpetas `sige/` y `sige-frontend/` con las de este zip
   (o al menos los 5 archivos del backend + toda la carpeta del frontend).
2. `git add . && git commit -m "Corrige errores de build para Render" && git push`
3. En Render, dale **Manual Sync** al Blueprint (o va a redesplegar solo
   apenas detecte el push, gracias al `autoDeploy: true`).

## Si vuelve a fallar
Cópiame el log completo de errores (no solo la parte visible) — hay
compañeros de la misma clase de error que quizás no alcanzamos a ver porque
el log se cortaba en la captura de pantalla. Con el log completo puedo
encontrar cualquier otro caso de una sola pasada en vez de ir arreglando de
a uno según lo que vaya fallando.
