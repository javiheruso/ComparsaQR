# Gestión Comparsa - Barraca

Sistema de gestión de crédito para socios de comparsa mediante pulseras con QR.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript 5
- **Base de datos:** PostgreSQL + Prisma ORM
- **UI:** Tailwind CSS v4
- **Autenticación:** iron-session (cookies httpOnly)
- **Validación:** Zod
- **Escáner QR:** html5-qrcode

## Funcionalidades

- **Pulseras QR:** Cada socio tiene un token QR único para identificación
- **Escáner móvil:** Cámaras frontal/trasera para escanear pulseras y cobrar consumiciones
- **Control de crédito:** Carga y consumo de crédito prepago
- **RBAC:** Roles admin, barra (cobrar), caja (recargar) y escáner básico
- **Panel admin:** Gestión de socios, productos, puntos de venta, transacciones
- **Importación:** CSV y sincronización desde sistema externo Gestion (Supabase)
- **Exportación:** CSV de socios y QR masivos en PDF
- **Modo invitado:** Perfil de invitado con crédito auto-reponible
- **Dashboard:** Estadísticas en tiempo real

## Requisitos

- Node.js 20+
- PostgreSQL 16+

## Configuración

1. Clona el repositorio
2. Copia `.env.example` a `.env` y completa las variables:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `ADMIN_PASSWORD` | Contraseña del admin (texto plano o hash bcrypt) |
| `SCANNER_PASSWORD` | Contraseña del escáner (debe diferir de admin) |
| `SESSION_SECRET` | Secreto para encriptar sesiones (32+ caracteres) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app |
| `GUEST_QR_TOKEN` | Token para el QR de invitado (opcional) |

3. Inicia PostgreSQL: `docker compose up -d`
4. Instala dependencias: `npm install`
5. Ejecuta migraciones: `npx prisma migrate dev`
6. Inicia dev: `npm run dev`

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo |
| `npm run build` | Build producción |
| `npm run start` | Iniciar producción |
| `npm run lint` | ESLint |
| `npm test` | Tests (vitest) |
| `npx prisma studio` | Explorar BD |

## Estructura

```
src/
├── app/
│   ├── admin/          # Panel de administración
│   ├── api/            # API routes (REST)
│   ├── scanner/        # Escáner QR móvil
│   ├── error.tsx       # Error boundary global
│   ├── not-found.tsx   # Página 404
│   └── page.tsx        # Landing page
├── lib/
│   ├── auth.ts         # Sesión y autenticación
│   ├── db.ts           # Cliente Prisma singleton
│   ├── guest-store.ts  # Perfil de invitado (DB)
│   ├── qr.ts           # Extracción de token QR
│   ├── rate-limit.ts   # Rate limiting (DB)
│   ├── schemas.ts      # Validación Zod
│   └── utils.ts        # Utilidades
├── proxy.ts            # Middleware de protección
└── generated/prisma/   # Cliente Prisma generado
```

## API

| Endpoint | Métodos | Auth | Descripción |
|----------|---------|------|-------------|
| `/api/auth/login` | POST | - | Login admin/escáner/punto |
| `/api/auth/logout` | POST | - | Cerrar sesión |
| `/api/auth/me` | GET | admin | Verificar sesión admin |
| `/api/scanner-auth/me` | GET | scanner | Verificar sesión escáner |
| `/api/scanner-auth/login` | POST | - | Login escáner |
| `/api/socios` | GET, POST | admin | Listar/crear socios |
| `/api/socios/[id]` | GET, PUT, DELETE | admin | CRUD socio individual |
| `/api/socios/[id]/credito` | POST | admin/caja | Cargar crédito |
| `/api/socios/[id]/consumo` | POST | scanner/barra | Cobrar consumición |
| `/api/socios/[id]/toggle-pulsera` | PATCH | admin | Activar/desactivar |
| `/api/socios/[id]/regenerar-qr` | PATCH | admin | Regenerar QR |
| `/api/productos` | GET, POST | admin | Listar/crear productos |
| `/api/productos/[id]` | PUT, DELETE | admin | Editar/eliminar producto |
| `/api/puntos` | GET, POST | admin | Listar/crear puntos de venta |
| `/api/puntos/[id]` | PUT, DELETE | admin | Editar/eliminar punto |
| `/api/transacciones` | GET | admin | Últimas transacciones |
| `/api/heartbeat` | GET | - | Keep-alive DB |
| `/api/scanner/[token]` | GET | scanner | Buscar socio por QR |
| `/api/socios/recargar-masivo` | POST | admin | Recarga por tipo |
| `/api/socios/recalcular-edades` | POST | admin | Reclasificar mayores de edad |
| `/api/socios/importar-gestion` | POST | admin | Importar desde CSV |
| `/api/sync-from-gestion` | POST | admin | Sincronizar con Gestion |

## Despliegue

Configurado para Vercel con cron job de heartbeat cada 2 días para evitar suspensión de BD gratuita.
