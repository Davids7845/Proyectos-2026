import * as XLSX from "xlsx";
import fs from "fs";
const buf = fs.readFileSync("tests/fixtures/budget_excel_real.xlsx");
const wb = XLSX.read(buf, { type: "buffer", cellFormula: false });
const sheet = wb.Sheets["Costo"];

function dumpRange(start: number, end: number, label: string) {
  console.log(`\n=== ${label} ===`);
  for (let r = start; r <= end; r++) {
    const f = sheet[`F${r}`]?.v;
    const m = sheet[`M${r}`]?.v;
    const i = sheet[`I${r}`]?.v;
    const p = sheet[`P${r}`]?.v;
    if (f == null && m == null) continue;
    const fl = (typeof f === "string" ? f : String(f ?? "")).padEnd(35);
    const iv = typeof i === "number" ? i.toFixed(2).padStart(12) : "        —";
    const pv = typeof p === "number" ? p.toFixed(2).padStart(12) : "        —";
    console.log(`R${r}: ${fl} | I=${iv} | P=${pv}`);
  }
}
dumpRange(26, 37, "ORD 3 Molienda Crudo (target row 36)");
dumpRange(76, 91, "ORD 6 Cemento UG (target row 90)");
dumpRange(92, 107, "ORD 7 Cemento ART (target row 106)");
dumpRange(150, 168, "ORD 16 Fibrocemento (target row 167)");
