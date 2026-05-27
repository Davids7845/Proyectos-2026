// ═══════════════════════════════════════════════════════════════════════
// PALETA CORPORATIVA ALIÓN
// Azul corporativo + Naranja de acento + Gris cementero neutral
// ═══════════════════════════════════════════════════════════════════════

export const BRAND = {
  // ─── AZUL CORPORATIVO (color principal Alión) ───
  primary:        "#1E40AF",  // azul Alión — blue-800
  primaryDark:    "#1E3A8A",  // azul profundo para hover/active — blue-900
  primaryLight:   "#3B82F6",  // azul claro para fondos sutiles — blue-500
  primarySoft:    "#DBEAFE",  // azul muy claro para badges/highlights — blue-100

  // ─── NARANJA ALIÓN (acento, productos ART) ───
  accent:         "#EA580C",  // naranja Alión — orange-600
  accentDark:     "#C2410C",  // naranja oscuro para hover — orange-700
  accentLight:    "#FB923C",  // naranja claro — orange-400
  accentSoft:     "#FED7AA",  // naranja muy claro para badges — orange-200

  // ─── NEUTROS (gris cementero del saco) ───
  ink:            "#0F172A",  // texto principal — slate-900
  inkSecondary:   "#475569",  // texto secundario — slate-600
  inkMuted:       "#94A3B8",  // texto desactivado/labels — slate-400

  // ─── FONDOS ───
  bgCard:         "#FFFFFF",  // tarjetas
  bgSubtle:       "#F8FAFC",  // fondo general página — slate-50
  bgBand:         "#F1F5F9",  // bandas alternadas tabla — slate-100
  bgHover:        "#F1F5F9",  // hover sobre filas
  border:         "#E2E8F0",  // bordes finos — slate-200
  borderStrong:   "#CBD5E1",  // bordes más definidos — slate-300

  // ─── ESTADOS SEMÁNTICOS ───
  success:        "#059669",  // verde — emerald-600
  successSoft:    "#D1FAE5",  // verde claro — emerald-100
  warning:        "#D97706",  // ámbar — amber-600
  warningSoft:    "#FEF3C7",  // ámbar claro — amber-100
  danger:         "#DC2626",  // rojo — red-600
  dangerSoft:     "#FEE2E2",  // rojo claro — red-100

  // ─── PALETA PARA CHARTS ───
  chart: [
    "#1E40AF",  // azul Alión (corporativo)
    "#EA580C",  // naranja Alión (acento)
    "#0891B2",  // cian complementario
    "#059669",  // verde fábrica
    "#7C3AED",  // morado pizarra
    "#475569",  // gris piedra
    "#D97706",  // ámbar cobre
    "#0F766E",  // teal mineral
  ],

  // ─── COLORES POR TIPO DE PRODUCTO (semántica Alión) ───
  productos: {
    ug:      "#1E40AF",  // Cemento UG → AZUL (identidad oficial)
    art:     "#EA580C",  // Cemento ART → NARANJA (identidad oficial)
    fibro:   "#0F766E",  // Fibrocemento → teal mineral
    clinker: "#475569",  // Clinker → gris piedra (semielaborado)
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
