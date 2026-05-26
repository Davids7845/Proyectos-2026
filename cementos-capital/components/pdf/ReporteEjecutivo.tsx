// Reporte ejecutivo PDF — Fase 2b Módulo 4.
// Server-side render con @react-pdf/renderer.

import React from "react";
import {
  Document as PdfDocument,
  Page as PdfPage,
  View as PdfView,
  Text as PdfText,
  StyleSheet,
} from "@react-pdf/renderer";

// Los typings de @react-pdf/renderer (clases con React.Component sin context)
// son anteriores a React 18 y rompen JSX. Forzamos a `any` localmente — el lib
// se exporta correctamente como elementos válidos en runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Document = PdfDocument as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Page     = PdfPage     as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const View     = PdfView     as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Text     = PdfText     as any;

export interface ReporteData {
  versionNombre: string;
  versionEstado: string;
  periodoInicio: string;
  periodoFin: string;
  generadoEn: string;

  // Página 2: matriz proceso × periodo
  procesos: Array<{ ord: number; nombre: string }>;
  periodos: string[];                                   // YYYY-MM-01 ordenados
  costoPorProcesoPeriodo: Record<string, number>;       // key: `${ord}|${periodo}` → COP/Ton
  produccionPorProcesoPeriodo: Record<string, number>;  // key: `${ord}|${periodo}` → Ton (rendimientos)

  // Página 1: resumen costos productos finales
  productosFinales: Array<{
    ord: number;
    nombre: string;
    costoPromedio: number;
    costoMinimo: number;
    costoMaximo: number;
  }>;

  // Página 3: top 5 insumos por impacto (suma del aporte en productos finales)
  topInsumos: Array<{
    codigo: string;
    nombre: string;
    aporteTotalCop: number;
    pctEstimado: number;
  }>;
}

const styles = StyleSheet.create({
  page:        { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  header:      { fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#111827" },
  subheader:   { fontSize: 11, color: "#4b5563", marginBottom: 16 },
  sectionH:    { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: "#111827", borderBottom: "1pt solid #e5e7eb", paddingBottom: 2 },
  row:         { flexDirection: "row" },
  rowBordered: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  cellH:       { padding: 4, backgroundColor: "#f3f4f6", fontWeight: 700, color: "#374151" },
  cell:        { padding: 4 },
  cellRight:   { padding: 4, textAlign: "right" },
  tableBody:   { borderTop: "0.5pt solid #d1d5db" },
  badge:       { padding: 2, paddingHorizontal: 4, borderRadius: 3, fontSize: 8 },
  footer:      { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#9ca3af", textAlign: "center" },
});

function fmt(n: number, dec = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPeriodo(p: string): string {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function ReporteEjecutivo({ data }: { data: ReporteData }): React.ReactElement {
  return (
    <Document>
      {/* ─── Página 1: Portada + Resumen productos ───────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Presupuesto de Costos de Producción</Text>
        <Text style={styles.subheader}>
          {data.versionNombre} · {fmtPeriodo(data.periodoInicio)} – {fmtPeriodo(data.periodoFin)} · Estado: {data.versionEstado}
        </Text>
        <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 12 }}>
          Generado: {data.generadoEn}
        </Text>

        <Text style={styles.sectionH}>Resumen de costos por producto final</Text>
        <View style={styles.tableBody}>
          <View style={styles.row}>
            <Text style={[styles.cellH, { flex: 0.6 }]}>ORD</Text>
            <Text style={[styles.cellH, { flex: 2 }]}>Producto</Text>
            <Text style={[styles.cellH, { flex: 1, textAlign: "right" }]}>Promedio (COP/Ton)</Text>
            <Text style={[styles.cellH, { flex: 1, textAlign: "right" }]}>Mínimo</Text>
            <Text style={[styles.cellH, { flex: 1, textAlign: "right" }]}>Máximo</Text>
          </View>
          {data.productosFinales.map(p => (
            <View key={p.ord} style={styles.rowBordered}>
              <Text style={[styles.cell, { flex: 0.6 }]}>{p.ord}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{p.nombre}</Text>
              <Text style={[styles.cellRight, { flex: 1 }]}>{fmt(p.costoPromedio)}</Text>
              <Text style={[styles.cellRight, { flex: 1 }]}>{fmt(p.costoMinimo)}</Text>
              <Text style={[styles.cellRight, { flex: 1 }]}>{fmt(p.costoMaximo)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Cementos Capital · Reporte ejecutivo confidencial · página 1</Text>
      </Page>

      {/* ─── Página 2: Matriz proceso × periodo ─────────────────────────── */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.header}>Costo por ton (COP) — Proceso × Periodo</Text>
        <Text style={styles.subheader}>{data.versionNombre}</Text>

        <View style={styles.tableBody}>
          <View style={styles.row}>
            <Text style={[styles.cellH, { width: 28 }]}>ORD</Text>
            <Text style={[styles.cellH, { flex: 2 }]}>Proceso</Text>
            {data.periodos.map(p => (
              <Text key={p} style={[styles.cellH, { flex: 1, textAlign: "right", fontSize: 7 }]}>
                {fmtPeriodo(p)}
              </Text>
            ))}
          </View>
          {data.procesos.map(proc => (
            <View key={proc.ord} style={styles.rowBordered}>
              <Text style={[styles.cell, { width: 28 }]}>{proc.ord}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{proc.nombre}</Text>
              {data.periodos.map(p => (
                <Text key={p} style={[styles.cellRight, { flex: 1, fontSize: 7 }]}>
                  {fmt(data.costoPorProcesoPeriodo[`${proc.ord}|${p}`] ?? NaN)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Cementos Capital · Reporte ejecutivo confidencial · página 2</Text>
      </Page>

      {/* ─── Página 3: Top 5 insumos por impacto ─────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Top insumos por impacto en productos finales</Text>
        <Text style={styles.subheader}>Aporte total agregado a lo largo de todos los procesos finales</Text>

        <View style={styles.tableBody}>
          <View style={styles.row}>
            <Text style={[styles.cellH, { flex: 1 }]}>Código</Text>
            <Text style={[styles.cellH, { flex: 3 }]}>Material</Text>
            <Text style={[styles.cellH, { flex: 1.5, textAlign: "right" }]}>Aporte total (COP/Ton agregado)</Text>
            <Text style={[styles.cellH, { flex: 1, textAlign: "right" }]}>% estimado</Text>
          </View>
          {data.topInsumos.map(t => (
            <View key={t.codigo} style={styles.rowBordered}>
              <Text style={[styles.cell, { flex: 1, fontFamily: "Courier" }]}>{t.codigo}</Text>
              <Text style={[styles.cell, { flex: 3 }]}>{t.nombre}</Text>
              <Text style={[styles.cellRight, { flex: 1.5 }]}>{fmt(t.aporteTotalCop)}</Text>
              <Text style={[styles.cellRight, { flex: 1 }]}>{(t.pctEstimado * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionH, { marginTop: 24 }]}>Notas y supuestos</Text>
        <Text style={{ marginBottom: 4, lineHeight: 1.5 }}>
          • Costos calculados con las recetas, precios y % de consumo cargados en la versión {data.versionNombre}.
        </Text>
        <Text style={{ marginBottom: 4, lineHeight: 1.5 }}>
          • Procesos terminales considerados: ORD 6 (Cemento UG), 7 (Cemento ART), 8–11 (Variantes empacadas),
            14 (Topex 50 kg), 15 (UG TP), 16 (Fibrocemento), 19 (Big Bag), 21 (Cementos agregado).
        </Text>
        <Text style={{ marginBottom: 4, lineHeight: 1.5 }}>
          • El aporte estimado de cada insumo proviene de las entradas precio_componente_directo y
            precio_componente_derivado registradas por el motor en el último run exitoso.
        </Text>

        <Text style={styles.footer}>Cementos Capital · Reporte ejecutivo confidencial · página 3</Text>
      </Page>
    </Document>
  );
}
