// ═══════════════════════════════════════════════════════════════════════
// PALETA CORPORATIVA ALIÓN — basada en Tema_Alion.json (Power BI oficial)
// dataColors: ["#0098BA","#003E39","#00CBBF","#58BCD2","#91D2E1",
//              "#003865","#FF8400","#F1E000"]
// foreground: "#486C81"  tableAccent: "#0098BA"
// ═══════════════════════════════════════════════════════════════════════

export const BRAND = {
  // ─── TEAL ALIÓN (color corporativo principal) ───
  primary:        "#0098BA",  // teal azul Alión — dataColors[0] / tableAccent
  primaryDark:    "#003865",  // azul marino Alión — dataColors[5]
  primaryLight:   "#58BCD2",  // teal medio — dataColors[3]
  primarySoft:    "#E0F5F9",  // teal muy claro para fondos/badges

  // ─── TEAL PROFUNDO (verde oscuro complementario) ───
  tealDark:       "#003E39",  // teal/verde oscuro — dataColors[1]
  tealBright:     "#00CBBF",  // teal brillante — dataColors[2]
  tealLight:      "#91D2E1",  // teal claro — dataColors[4]

  // ─── NARANJA ALIÓN (acento) ───
  accent:         "#FF8400",  // naranja Alión — dataColors[6]
  accentDark:     "#CC6A00",  // naranja oscuro para hover
  accentLight:    "#FFB366",  // naranja claro
  accentSoft:     "#FFE8C4",  // naranja muy claro para badges

  // ─── AMARILLO ALIÓN (terciario) ───
  yellow:         "#F1E000",  // amarillo Alión — dataColors[7]

  // ─── NEUTROS ───
  ink:            "#003865",  // texto principal — navy Alión
  inkSecondary:   "#486C81",  // texto secundario — foreground oficial
  inkMuted:       "#7FA3B3",  // texto desactivado/labels

  // ─── FONDOS ───
  bgCard:         "#FFFFFF",
  bgSubtle:       "#F0F9FB",  // fondo página — teal muy sutil
  bgBand:         "#E5F4F8",  // bandas alternadas tabla — teal claro
  bgHover:        "#D6EEF5",  // hover filas
  border:         "#B8DDE8",  // bordes finos — teal suave
  borderStrong:   "#7BBDCE",  // bordes más definidos

  // ─── ESTADOS SEMÁNTICOS ───
  success:        "#059669",
  successSoft:    "#D1FAE5",
  warning:        "#D97706",
  warningSoft:    "#FEF3C7",
  danger:         "#DC2626",
  dangerSoft:     "#FEE2E2",

  // ─── PALETA PARA CHARTS (orden oficial del tema Alión) ───
  chart: [
    "#0098BA",  // teal azul principal
    "#FF8400",  // naranja acento
    "#003E39",  // teal oscuro
    "#00CBBF",  // teal brillante
    "#003865",  // azul marino
    "#58BCD2",  // teal medio
    "#F1E000",  // amarillo Alión
    "#91D2E1",  // teal claro
  ],

  // ─── COLORES POR TIPO DE PRODUCTO (semántica Alión) ───
  productos: {
    ug:      "#0098BA",  // Cemento UG → teal azul (color principal Alión)
    art:     "#FF8400",  // Cemento ART → naranja Alión
    fibro:   "#003E39",  // Fibrocemento → teal oscuro
    clinker: "#486C81",  // Clinker → gris azulado (foreground oficial)
  },
} as const;

// ─── HELPERS DE FORMATO ───────────────────────────────────────────────

export function formatCOP(n: number): string {
  if (n == null || isNaN(n)) return "—";
  return "$ " + Math.round(n).toLocaleString("es-CO");
}

export function formatPct(n: number, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals) + " %";
}

export function formatMes(periodo: string): string {
  const d = new Date(periodo + "T00:00:00");
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

/** Devuelve el color semántico para una variación numérica.
 *  inverso=true → "más es peor" (ej. costos subieron) */
export function colorVariacion(delta: number, inverso = false): string {
  if (delta === 0) return BRAND.inkMuted;
  if (inverso) return delta > 0 ? BRAND.danger : BRAND.success;
  return delta > 0 ? BRAND.success : BRAND.danger;
}
