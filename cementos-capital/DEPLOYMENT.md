# Guía de Despliegue — Cementos Capital

Esta guía cubre el despliegue completo a producción: Supabase Cloud + Vercel.

---

## Pre-requisitos

- Cuenta en [GitHub](https://github.com) con el repositorio
- Cuenta en [Supabase](https://supabase.com) (tier Free es suficiente para empezar)
- Cuenta en [Vercel](https://vercel.com) (tier Free es suficiente)
- Node.js 20+ instalado localmente

---

## Paso 1 — Configurar Supabase Cloud

### 1.1 Crear proyecto

1. Ir a https://supabase.com/dashboard → **New Project**
2. Nombre sugerido: `cementos-capital-prod`
3. **Región recomendada**: `sa-east-1` (São Paulo) o `us-east-1` (N. Virginia)
   - Elegir la más cercana al equipo para latencia mínima
4. Elegir un password seguro para la BD y guardarlo

### 1.2 Obtener credenciales

Ir a **Settings → API** y anotar:
- **Project URL**: `https://<ref>.supabase.co`
- **anon public key**: clave pública (aparece primera)
- **service_role secret key**: clic en "Reveal" para verla — guardar en lugar seguro

### 1.3 Aplicar migrations

En el **SQL Editor** del dashboard, ejecutar los archivos en este orden:

| Archivo | Contenido |
|---|---|
| `supabase/migrations/001_schema.sql` | Tablas base (budget_versions, procesos, materiales, recetas, etc.) |
| `supabase/migrations/002_seed_masters.sql` | Seed: 17 procesos ORD, materiales, clases de costo |
| `supabase/migrations/003_add_combalt.sql` | Material Combustibles Alternos |
| `supabase/migrations/004_material_aliases.sql` | Tabla de aliases para el importer |
| `supabase/migrations/_apply_all_pending.sql` | Migrations 005+006+007 (idempotente, se puede repetir) |

Copiar el contenido de cada archivo, pegarlo en el SQL Editor y hacer clic en **Run**.

### 1.4 Configurar timezone

En el SQL Editor ejecutar:

```sql
alter database postgres set timezone to 'America/Bogota';
```

### 1.5 Verificar con db:status

Desde tu máquina local, con `.env.local` apuntando a la BD recién creada:

```bash
npm run db:status
```

Debe mostrar todas las tablas con ✓ y los 17 procesos ORD.

---

## Paso 2 — Configurar Vercel

### 2.1 Importar el repositorio

1. Ir a https://vercel.com/new
2. Seleccionar el repositorio de GitHub
3. En **Configure Project**:
   - **Root Directory**: `cementos-capital` (importante — el repo tiene carpeta raíz)
   - **Framework Preset**: Next.js (auto-detectado)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.2 Variables de entorno

En Vercel → Settings → Environment Variables, agregar:

| Nombre | Valor | Entornos |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | tu service_role key | Production, Preview, Development |

> **Seguridad**: `SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo `NEXT_PUBLIC_` por diseño — Next.js no la expone al navegador.

### 2.3 Región de Vercel (opcional)

Para reducir latencia entre Vercel y Supabase, ir a **Settings → Functions** y elegir la región más cercana a tu proyecto Supabase:
- Supabase `sa-east-1` → Vercel `gru1` (São Paulo)
- Supabase `us-east-1` → Vercel `iad1` (Washington D.C.)

### 2.4 Hacer deploy

Clic en **Deploy**. El build tarda ~2 minutos.

---

## Paso 3 — Validar el despliegue

### 3.1 Acceder a la app

Abrir la URL de Vercel (ej: `https://cementos-capital.vercel.app`).

### 3.2 Crear usuario en Supabase Auth

1. Ir a Supabase Dashboard → **Authentication → Users**
2. Clic en **Add User** → **Create new user**
3. Ingresar email y password
4. Verificar que el usuario puede hacer login en la app

### 3.3 Smoke test

```bash
npm run db:smoke
```

Verifica:
- Service role puede insertar y leer datos
- RLS bloquea acceso anónimo
- Limpia los datos de prueba automáticamente

### 3.4 Test end-to-end manual

1. Login en la app
2. **Versiones → Nueva Versión** (nombre: "Prueba Despliegue")
3. Entrar al detalle de la versión
4. **Datos → Importar Excel** → subir `Nueva_Plantilla_Ppto_CV_V2.xlsx`
5. Revisar el reporte de importación (0 errores esperado)
6. **Calcular** → Ejecutar Cálculo
7. Verificar que aparecen resultados en **Costo** y **Dashboard**

---

## Troubleshooting

### Build falla por errores de TypeScript

```
Error: Type 'X' is not assignable to type 'Y'
```

La causa más común es que `lib/supabase/types.ts` está desactualizado. Regenerar:

```bash
npx supabase gen types typescript \
  --project-id <ref> \
  --schema public > lib/supabase/types.ts
```

O desde el dashboard local de Supabase CLI si está configurado.

### "Failed to fetch" al ejecutar cálculo

El motor de cálculo puede tardar más de 10 segundos en datasets grandes. El plan Free de Vercel limita las API routes a 10s.

**Solución**: El archivo `app/api/versiones/[id]/calcular/route.ts` ya tiene `export const maxDuration = 60;` configurado, pero esto requiere plan **Pro** de Vercel. En plan Free, el cálculo debe completarse en < 10s.

Si el cálculo falla por timeout:
1. Upgradear a Vercel Pro, o
2. Reducir el número de periodos calculados por request

### Importer del Excel falla en producción (payload demasiado grande)

El archivo Excel puede superar el límite por defecto de Vercel para bodies de API (4.5 MB).

Si el importer devuelve `413 Entity Too Large`, agregar a `next.config.js`:

```js
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
```

### "Movimientos vacíos" en /costo

Verificar con `npm run db:status` que aparecen los 17 procesos seed (ORD 1–21). Si faltan, aplicar `002_seed_masters.sql` en el SQL Editor.

### RLS bloqueando operaciones con usuario autenticado

Si un usuario autenticado no puede leer/escribir datos, revisar las policies en Supabase → Authentication → Policies. Todas las tablas deben tener policies que permitan acceso a `authenticated` role.

---

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` **nunca** debe aparecer en commits, logs, ni en el cliente del navegador
- Las RLS policies están configuradas para que solo usuarios autenticados accedan a los datos
- El smoke test verifica que las RLS policies bloquean acceso anónimo
- Para producción con múltiples usuarios, revisar y restringir las policies según roles específicos (en Fase 2)
