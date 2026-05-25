# Tests E2E — Cementos Capital

Suite Playwright que valida el flujo completo en producción (Vercel + Supabase Cloud).

## Setup inicial

### 1. Crear usuario E2E en Supabase

En el Dashboard de Supabase → **Authentication → Users → "Add user"**:
- Email: `e2e-test@cementoscapital.com` (o el que prefieras)
- Password: generar uno fuerte (≥16 chars)
- **Marcar "Auto Confirm User"**

### 2. Configurar variables de entorno

```bash
cp .env.e2e.example .env.e2e.local
```

Editar `.env.e2e.local` con las credenciales reales:

| Variable | Descripción |
|---|---|
| `PLAYWRIGHT_BASE_URL` | URL de la app. Default: producción Vercel |
| `PLAYWRIGHT_TEST_EMAIL` | Email del usuario E2E |
| `PLAYWRIGHT_TEST_PASSWORD` | Password de ese usuario |
| `SUPABASE_URL` | (opcional) Para limpieza pre/post-test |
| `SUPABASE_SERVICE_ROLE_KEY` | (opcional) Para limpieza pre/post-test |

> ⚠️ `.env.e2e.local` está en `.gitignore`. **Nunca commitear credenciales.**

### 3. Instalar browsers

```bash
npx playwright install chromium --with-deps
```

## Correr los tests

```bash
# Headless (CI / producción)
npm run test:e2e

# Con navegador visible (para depurar)
npm run test:e2e:headed

# UI interactiva de Playwright
npm run test:e2e:ui

# Ver reporte HTML después de correr
npm run test:e2e:report
```

## Tests disponibles

| Archivo | Descripción | Duración aprox. |
|---|---|---|
| `00-smoke.spec.ts` | Login + procesos + fórmulas | ~20s |
| `01-flujo-completo.spec.ts` | Login → crear versión → importar Excel → calcular → validar costos → trazabilidad → dashboard | ~3-5 min |

## Valores esperados (sep-2025)

El test `01-flujo-completo` valida:
- **Cemento UG** (ORD 6): ≈ 95.900 COP/Ton ±1%
- **Clinkerización** (ORD 5): ≈ 113.463 COP/Ton ±1%
