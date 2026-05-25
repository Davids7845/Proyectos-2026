import path from 'path';
import fs from 'fs';

export function getExcelFixturePath(): string {
  const candidates = [
    'tests/fixtures/budget_excel_real.xlsx',
    'tests/fixtures/Nueva_Plantilla_Ppto_CV_V2.xlsx',
  ];
  for (const c of candidates) {
    const abs = path.resolve(process.cwd(), c);
    if (fs.existsSync(abs)) return abs;
  }
  throw new Error(
    `No se encontró fixture Excel. Esperado en: ${candidates.join(' o ')}`
  );
}
