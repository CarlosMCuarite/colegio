# SIGE V8 — Cómo correr el proyecto

## PASO 1 — Variables de entorno (solo la primera vez)
Crea el archivo `sige/.env` con esto:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
JWT_SECRET="sige-secret-2024"
PORT=4000
NODE_ENV=development
```

## PASO 2 — Instalar dependencias

```bash
cd sige
npm install

cd ../sige-frontend
npm install
```

## PASO 3 — Sincronizar schema con la base de datos

```bash
cd sige
npm run db:push
```

Este comando:
- Lee el schema.prisma
- Compara con la BD en Supabase
- Aplica los cambios necesarios (agrega slug, licencias, etc.)
- NO borra datos existentes

## PASO 4 — Generar cliente Prisma

```bash
npm run db:generate
```

## PASO 5 — Correr el seed

```bash
npm run db:seed
```

Crea:
- Plan Básico, Estándar, Premium
- Colegio Encinas (slug: encinas)
- SuperAdmin: carce240201@gmail.com / 75764047
- Admin: admin@encinas.edu.pe / Admin2024!

## PASO 6 — Correr backend y frontend

```bash
# Terminal 1 — Backend
cd sige
npm run dev

# Terminal 2 — Frontend
cd sige-frontend
npm run dev
```

## URLs

| URL | Descripción |
|-----|-------------|
| http://localhost:3000/auth/login | Login global (SuperAdmin) |
| http://localhost:3000/colegio/encinas | Portal público Encinas |
| http://localhost:3000/colegio/encinas/login | Login con branding Encinas |
| http://localhost:4000/health | Estado del backend |

## Si la BD ya tiene datos de versiones anteriores

```bash
# Opción A — Solo sincronizar schema (conserva datos)
npm run db:push

# Opción B — Borrar todo y empezar limpio (CUIDADO: elimina datos)
npm run db:reset
npm run db:push
npm run db:seed
```
