import { createClient } from '@supabase/supabase-js';

export async function cleanupTestVersions() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('Skip cleanup: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados');
    return;
  }
  const supabase = createClient(url, key);
  const { error } = await supabase
    .from('budget_versions')
    .delete()
    .like('nombre', 'E2E_TEST_%');
  if (error) console.warn('Cleanup falló:', error.message);
}
