# Cementos Capital — Motor de Presupuesto

Sistema de cálculo de costos de producción para una planta cementera. Toma como entrada una plantilla Excel de presupuesto (precios, recetas, rendimientos, energía) y produce el costo unitario por tonelada de cada proceso (Trituración → Clinker → Cemento → Fibrocemento) con trazabilidad completa de cada cálculo.

Motor reconciliado contra el Excel real con diferencia < 1% en todos los procesos.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 App Router (React 18, TypeScript strict) |
| Base de datos | Supabase (PostgreSQL 15 + Auth + RLS) |
| ORM / cliente | `@supabase/supabase-js` + SSR helpers |
| Tablas UI | TanStack Table v8 |
| Gráficas | Recharts v3 |
| Aritmética decimal | decimal.js |
| Exportación Excel | ExcelJS |
| Importación Excel | SheetJS (xlsx) |
| Tests | Vitest |
| Estilos | Tailwind CSS + Radix UI |

---

## Estructura del repositorio

```
cementos-capital/
├── app/
│   ├── (app)/                   # Rutas autenticadas
│   │   ├── versiones/           # Lista de versiones de presupuesto
│   │   │   └── [id]/            # Detalle: datos, recetas, energía, dashboard, cálculos, costo
│   │   └── admin/               # Maestros: materiales, fórmulas, SAP
│   └── api/
│       └── versiones/[id]/
│           ├── calcular/        # POST → dispara motor de cálculo
│           ├── import/          # POST → importa Excel
│           ├── export/          # GET → exporta resultados a Excel
│           ├── precios/         # GET/POST precios insumos
│           └── recetas/         # GET/POST recetas
├── lib/
│   ├── calc/
│   │   ├── engine/              # runner.ts, writer.ts, context.ts — orquestador
│   │   ├── procesos/            # ORD 1–21: calculadoras por proceso
│   │   └── formulas/            # Registro de fórmulas auditables
│   ├── import/
│   │   ├── excel-importer.ts    # Parser de hoja "Datos" y "Costo"
│   │   ├── excel-loader.ts      # Carga parsed → Supabase
│   │   └── costo-sheet-config.ts # Config filas/columnas hoja Costo
│   └── supabase/                # cliente server/client/admin, tipos generados
├── supabase/
│   └── migrations/              # 001–007: schema completo
├── tests/
│   ├── reconciliation/          # Tests contra Excel real (< 1% gap)
│   └── fixtures/                # Helpers de contexto in-memory
├── scripts/
│   ├── db-status.ts             # Verifica estado de la BD
│   └── db-smoke-test.ts         # Smoke test post-despliegue
├── .env.example
└── DEPLOYMENT.md
```

---

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto en Supabase Cloud

1. Ir a https://supabase.com/dashboard → "New Project"
2. Elegir región (recomendado: `sa-east-1` São Paulo o `us-east-1` N. Virginia)
3. Anotar los valores de **Settings → API**:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local` con los valores de Supabase (ver tabla de variables más abajo).

### 4. Aplicar migrations a la BD

Ir al SQL Editor de Supabase y ejecutar el contenido de `supabase/migrations/_apply_all_pending.sql` (contiene las migraciones 005–007, idempotente). Las migraciones 001–004 deben ejecutarse primero si es una BD nueva:

```
001_schema.sql        → tablas base (budget_versions, procesos, materiales, recetas, etc.)
002_seed_masters.sql  → datos semilla: 17 procesos ORD, materiales
003_add_combalt.sql   → material Combustibles Alternos
004_material_aliases.sql → tabla de aliases
_apply_all_pending.sql   → 005 + 006 + 007 (tablas extra + modelo térmico + overrides)
```

Configurar timezone:
```sql
alter database postgres set timezone to 'America/Bogota';
```

### 5. Verificar estado de la BD

```bash
npm run db:status
```

### 6. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000

---

## Despliegue a Vercel

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones completas.

Resumen rápido:
1. Importar el repo en https://vercel.com/new
2. Root directory: `cementos-capital`
3. Agregar las 3 variables de entorno en Vercel → Settings → Environment Variables
4. Deploy

---

## Variables de entorno

| Variable | Descripción | Dónde obtener | Visibilidad |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Dashboard → Settings → API → Project URL | Pública (cliente) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (respeta RLS) | Dashboard → Settings → API → anon public | Pública (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (omite RLS) | Dashboard → Settings → API → service_role secret | **Privada — solo server** |

> `SUPABASE_SERVICE_ROLE_KEY` se usa únicamente en rutas de API (`/api/versiones/[id]/import`, motor de cálculo). Nunca exponer al navegador.

---

## Scripts npm

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo Next.js en http://localhost:3000 |
| `npm run build` | Build de producción (verifica tipos y linting) |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm test` | Todos los tests (vitest, modo CI) |
| `npm run test:watch` | Tests en modo watch interactivo |
| `npm run test:reconciliation` | Solo tests de reconciliación contra Excel (los más lentos) |
| `npm run db:status` | Verifica que todas las tablas y datos semilla existen en Supabase |
| `npm run db:smoke` | Smoke test end-to-end: crea datos de prueba, verifica RLS, limpia |
| `npm run predeploy` | `npm test && npm run build` — barrera antes de desplegar |

---

## Importar el Excel inicial

1. Crear una versión en **Versiones → Nueva Versión**
2. Entrar al detalle de la versión
3. Ir a la pestaña **Datos**
4. Usar el botón **Importar Excel** y subir `Nueva_Plantilla_Ppto_CV_V2.xlsx`
5. Revisar el reporte de importación (materiales no encontrados, advertencias)

El importer procesa las hojas **Datos** y **Costo** automáticamente:
- Hoja *Datos*: precios, recetas, humedades, rendimientos, ventas, energía
- Hoja *Costo*: costos fijos de repuestos/servicios, overrides de energía y MP

---

## Ejecutar cálculo y ver resultados

1. Con el Excel importado, ir a la pestaña **Calcular** de la versión
2. Hacer clic en **Ejecutar Cálculo** — el motor corre en background (máx. 60s)
3. Ver los resultados en la pestaña **Costo**: árbol de costos por proceso con desglose
4. La pestaña **Dashboard** muestra gráficas comparativas entre procesos
5. Usar **Exportar** para descargar los resultados en Excel

El cálculo sigue el orden topológico de los 17 procesos: Trituración (ORD 1) → Molienda Crudo (ORD 3) → Molienda Carbón (ORD 4) → Combustibles Alternos (ORD 20) → Clinkerización (ORD 5) → Cemento UG/ART/Fibrocemento (ORD 6/7/16) → empaques y cementos compuestos.

---

## Tests

```bash
# Todos los tests (86 tests, ~15s)
npm test

# Solo reconciliación contra Excel real (los más representativos, ~3s)
npm run test:reconciliation

# Modo watch para desarrollo
npm run test:watch
```

Los tests de reconciliación verifican que el motor reproduce el Excel presupuesto con diferencia < 1% en todos los procesos. Requieren el fixture `tests/fixtures/budget_excel_real.xlsx` (no incluido en el repo por razones de confidencialidad — copiar manualmente).

---

## Limitaciones conocidas (Fase 1)

Esta versión implementa el **motor de cálculo del presupuesto** y la **UI de visualización**. Las siguientes funcionalidades están fuera del alcance de Fase 1 y están planificadas para Fase 2:

| Funcionalidad | Estado |
|---|---|
| Edición de fórmulas desde la UI | Fase 2 |
| Escenarios / sensibilidades (qué pasa si sube el precio del carbón) | Fase 2 |
| Integración con SAP (lectura automática de costos reales) | Fase 2 |
| Movimientos contables automáticos | Fase 2 |
| Comparación presupuesto vs real en dashboard | Fase 2 |
| Múltiples plantas / BUs | Fase 2 |
| Flujo de aprobación de versiones | Fase 2 |

Los costos fijos (repuestos, servicios industriales, regalías) se extraen directamente del Excel presupuesto en Fase 1. En Fase 2 se reconstruirán desde `cantidad × precio / producción` con materiales registrados en BD.
