// Script temporal para aplicar una migration via Supabase pg REST.
// Uso: tsx --env-file .env.local scripts/_apply_migration.ts <archivo.sql>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) { console.error("Uso: tsx scripts/_apply_migration.ts <archivo.sql>"); process.exit(1); }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Verificar si material_aliases ya existe
  const { error: checkErr } = await (sb as any).from("material_aliases").select("id").limit(1);
  if (!checkErr) {
    console.log("✓ material_aliases ya existe — migration 004 ya aplicada");
    process.exit(0);
  }
  console.log("Tabla no existe:", checkErr.message);
  console.log("\nNo es posible ejecutar DDL vía el SDK de Supabase.");
  console.log("Debes aplicar la migración manualmente en el SQL Editor de Supabase:");
  console.log(`  Archivo: ${resolve(sqlFile)}`);
  process.exit(1);
}
main().catch(console.error);
