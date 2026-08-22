# SIGE — Listo para desplegar en Render

## Qué se agregó esta vuelta
- `render.yaml` (raíz) — define los 2 servicios (backend + frontend) listos
  para crear con un clic vía "Blueprint".
- `.gitignore` (raíz) — reforzado.
- `.env.example` en `sige/` y `sige-frontend/` — reescritos para reflejar
  EXACTAMENTE las variables que el código usa de verdad (antes tenían
  variables que no se usan, como `JWT_SECRET`/`DIRECT_URL`, y les faltaban
  otras que sí se usan, como los códigos de recuperación).
- **Encontré algo importante**: `ADMIN_RECOVERY_CODE` y
  `SUPERADMIN_RECOVERY_CODE` tienen un valor de respaldo escrito directo en
  `src/routes/auth.ts` (para que el sistema no truene si faltan) — pero ese
  valor de respaldo ya quedó público al subir el repo a GitHub. **Defínelos
  con un código propio en Render antes de usar el sistema con datos
  reales** — si no, cualquiera que vea tu repo conoce el código de
  recuperación de contraseña del Admin.

## Cómo usar el render.yaml (Blueprint) — paso a paso

1. Sube estos cambios a GitHub:
   ```bash
   git add .
   git commit -m "Listo para desplegar en Render"
   git push
   ```

2. En Render: **New → Blueprint**.

3. Conecta tu repositorio de GitHub (`CarlosMCuarite/colegio`).

4. Render detecta el `render.yaml` automáticamente y te muestra los 2
   servicios (`sige-backend` y `sige-frontend`) listos para crear —
   revisa que diga eso y dale a **Apply**.

5. Render te va a pedir los valores de las variables marcadas `sync: false`
   (las que son secretas) — cópialas de tu `.env` local:
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_RECOVERY_CODE`, `SUPERADMIN_RECOVERY_CODE` — pon algo tuyo, NO
     dejes esto vacío ni copies el que está en el código.

6. Espera a que ambos servicios terminen de compilar (el backend tarda un
   poco más por el `prisma generate`).

7. **Ajusta las URLs cruzadas** — la primera vez, Render te da URLs con un
   sufijo aleatorio si el nombre exacto ya existía (ej.
   `sige-backend-a1b2.onrender.com` en vez de `sige-backend.onrender.com`).
   Si pasó eso, entra a cada servicio → Environment y corrige:
   - En `sige-frontend`: `NEXT_PUBLIC_API_URL` → la URL real del backend + `/api/v1`
   - En `sige-backend`: `CORS_ORIGINS` → la URL real del frontend
   
   Guardar cualquiera de estos dos dispara un redeploy automático — normal.

## ¿Ya es automático de aquí en adelante?
**Sí.** Una vez conectado el repo (con o sin `render.yaml`), cada `git push`
a `main` dispara un deploy solo en ambos servicios — eso es "Auto-Deploy",
viene activado por defecto (el `autoDeploy: true` del yaml solo lo deja
explícito). No necesitas volver a tocar nada en Render para futuros
cambios, solo hacer push.

## Después del primer deploy — falta 1 paso manual
Corre la migración de la base de datos UNA vez (Render no lo hace solo):
en el dashboard del backend → **Shell** (pestaña junto a Logs) → 
```
npx prisma db push
```
o aplica los `.sql` de `sige/prisma/migrations_manual/` directo en el SQL
Editor de Supabase, si prefieres ese método (el que has venido usando).

## Nota sobre el plan "starter" vs "free"
Dejé `plan: starter` en el yaml (de pago, pero sin el "sleep" de 15 min de
inactividad). Si quieres probar gratis primero, cambia `starter` por `free`
en ambos servicios del `render.yaml` — el único costo es que el backend se
duerme tras 15 min sin tráfico y la primera petición después tarda ~30-50
segundos en despertar (normal del free tier, no es un bug).
