# SIGE — Sistema Integral de Gestión Escolar

SaaS multi-colegio para colegios privados pequeños y medianos (200–2000 alumnos).

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, Bootstrap 5, Framer Motion, Recharts |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma ORM |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Storage | Supabase Storage + Sharp (WebP) |
| Notificaciones | Firebase Cloud Messaging |
| QR | html5-qrcode |
| Validación | Zod |
| Hosting | Render |

## Estructura del Proyecto

```
sige/              ← Backend (Node.js + Express)
sige-frontend/     ← Frontend (Next.js)
```

## Instalación y Ejecución

### Backend
```bash
cd sige
cp .env.example .env   # Completar variables de entorno
npm install
npm run db:generate    # Genera el cliente Prisma
npm run db:migrate     # Aplica migraciones
npm run db:seed        # Datos iniciales
npm run dev            # Servidor en puerto 4000
```

### Frontend
```bash
cd sige-frontend
cp .env.example .env   # Completar variables de entorno
npm install
npm run dev            # App en puerto 3000
```

## Variables de Entorno

Ver `sige/.env.example` para la lista completa.

## Credenciales Iniciales (seed)

| Rol | Email | Password |
|-----|-------|----------|
| Superadmin | superadmin@sige.edu.pe | SuperAdmin2024! |
| Admin demo | admin@colegio.edu.pe | Admin2024! |

> ⚠️ Cambiar inmediatamente en producción.

## Módulos Implementados

- ✅ Multi-tenant (aislamiento por colegio)
- ✅ Roles: Superadmin, Admin, Director, Secretaría, Docente, Padre
- ✅ Roles opcionales: Auxiliar, Psicólogo, Coordinador, Tutor, Contador, Enfermería
- ✅ Gestión de Estudiantes (soft-delete + retención configurable)
- ✅ Gestión de Padres + Dashboard exclusivo
- ✅ Matrículas presenciales
- ✅ Asistencia QR (DNI como código)
- ✅ Pagos + vouchers Supabase Storage
- ✅ Comunicados segmentados (colegio/nivel/grado/sección)
- ✅ Calendario de Eventos
- ✅ Encuestas + resultados
- ✅ Observaciones disciplinarias
- ✅ Permisos de salida (flujo docente→secretaría→padre)
- ✅ Gestión Documental
- ✅ Horarios con detección de solapamiento
- ✅ Dashboard Ejecutivo (gráficos Recharts estilo Power BI)
- ✅ Dashboard Padre (asistencia, pagos, comunicados, etc.)
- ✅ Dashboard Superadmin (vista global multi-colegio)
- ✅ Chatbot Padres + Chatbot Administrativo (datos reales)
- ✅ Widget flotante animado (3 estados: esperando/pensando/respondiendo)
- ✅ Firebase Cloud Messaging (notificaciones push)
- ✅ Conversión automática PNG/JPG → WebP (Sharp)
- ✅ Backups automáticos cada hora (rotación 7 versiones)
- ✅ Exportaciones históricas ZIP + JSON (solo lectura)
- ✅ Auditoría completa (usuario, acción, IP, módulo)
- ✅ Membresías (Básico/Estándar/Premium) + alertas de vencimiento
- ✅ WhatsApp institucional configurable
- ✅ Modo oscuro / claro
- ✅ Salud escolar (configurable por padre)

## Despliegue en Render

1. Crear cuenta en render.com
2. Conectar repositorio de GitHub
3. Usar el archivo `render.yaml` del proyecto
4. Configurar variables de entorno en el dashboard de Render
5. Ejecutar `npm run db:migrate:prod` en el primer deploy

## Seguridad

- Rate limiting: 300 req/15min global, 10 req/15min para login
- JWT via Supabase Auth
- Aislamiento multi-tenant en middleware
- Auditoría de todas las acciones críticas
- Soft-delete con retención configurable
- Helmet.js headers de seguridad
